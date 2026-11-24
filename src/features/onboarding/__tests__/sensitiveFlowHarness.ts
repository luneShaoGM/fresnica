import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SensitiveTextInput, type SensitiveTextInputHandle, type SensitiveTextInputProps } from '../SensitiveTextInput';

type Effect = { deps?: React.DependencyList; cleanup?: () => void };
function same(left?: React.DependencyList, right?: React.DependencyList) {
  return !!left && !!right && left.length === right.length && left.every((value, i) => Object.is(value, right[i]));
}

// Executes the real components and event callbacks with retained hook state and
// explicit native-field/focus/AppState ports. This is host behavior evidence.
export class SensitiveFlowHarness {
  readonly states: unknown[] = [];
  readonly refs: Array<{ current: unknown }> = [];
  private effects: Effect[] = [];
  private memos: Array<{ deps?: React.DependencyList; value: unknown }> = [];
  private focusCallback?: () => void | (() => void);
  private focusCleanup?: () => void;
  private focused = true;

  render<T>(render: () => T, attachNativeRefs?: (result: T) => void): T {
    let si = 0, ri = 0, ei = 0, mi = 0;
    const pending: Array<() => void> = [];
    jest.mocked(React.useState).mockImplementation(((initial: unknown) => {
      const index = si++;
      if (!(index in this.states)) this.states[index] = typeof initial === 'function' ? initial() : initial;
      return [this.states[index], (next: unknown) => {
        this.states[index] = typeof next === 'function' ? next(this.states[index]) : next;
      }];
    }) as typeof React.useState);
    jest.mocked(React.useRef).mockImplementation(((initial: unknown) => {
      const index = ri++;
      return this.refs[index] ?? (this.refs[index] = { current: initial });
    }) as typeof React.useRef);
    jest.mocked(React.useCallback).mockImplementation(((callback: unknown, deps?: React.DependencyList) => {
      const index = mi++;
      if (!same(this.memos[index]?.deps, deps)) this.memos[index] = { deps, value: callback };
      return this.memos[index].value;
    }) as typeof React.useCallback);
    jest.mocked(React.useEffect).mockImplementation((effect, deps) => {
      const index = ei++;
      if (!same(this.effects[index]?.deps, deps)) pending.push(() => {
        this.effects[index]?.cleanup?.();
        this.effects[index] = { deps, cleanup: effect() || undefined };
      });
    });
    jest.mocked(React.useLayoutEffect).mockImplementation(jest.mocked(React.useEffect));
    jest.mocked(React.useImperativeHandle).mockImplementation((ref, factory) => {
      pending.push(() => assignRef(ref, factory()));
    });
    jest.mocked(useIsFocused).mockImplementation(() => this.focused);
    jest.mocked(useFocusEffect).mockImplementation(callback => {
      if (this.focusCallback === callback) return;
      pending.push(() => {
        this.focusCleanup?.();
        this.focusCallback = callback;
        this.focusCleanup = this.focused ? callback() || undefined : undefined;
      });
    });
    const result = render();
    attachNativeRefs?.(result);
    pending.forEach(commit => commit());
    return result;
  }

  blur() {
    this.focused = false;
    this.focusCleanup?.();
    this.focusCleanup = undefined;
  }
  focus() {
    this.focused = true;
    this.focusCleanup = this.focusCallback?.() || undefined;
  }
  unmount() {
    this.effects.forEach(effect => effect.cleanup?.());
    this.focusCleanup?.();
    this.focusCleanup = undefined;
  }
}

export function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export function renderForwardRef<P, H>(component: unknown, props: P, ref: React.Ref<H>) {
  return (component as { render: (input: P, target: React.Ref<H>) => React.ReactElement }).render(props, ref);
}

export function nativeField() {
  let text = '';
  return {
    read: () => text,
    type: (next: string) => { text = next; },
    clear: jest.fn(() => { text = ''; }),
    setNativeProps: jest.fn((props: { text: string }) => { text = props.text; }),
  };
}

export function sensitiveField(props: SensitiveTextInputProps = {}, ref?: React.Ref<SensitiveTextInputHandle>) {
  const h = new SensitiveFlowHarness();
  const native = nativeField();
  const handle = { current: null as SensitiveTextInputHandle | null };
  let input: React.ReactElement;
  const render = (next = props) => {
    props = next;
    input = h.render(() => renderForwardRef(SensitiveTextInput, props, handle), rendered => {
      assignRef((rendered.props as { ref?: React.Ref<unknown> }).ref, native);
    });
    assignRef(ref, handle.current);
    return input;
  };
  render();
  return {
    h, native, handle, render,
    type(value: string) {
      native.type(value);
      (input.props as { onChangeText: (value: string) => void }).onChangeText(value);
    },
    close: () => { h.unmount(); assignRef(ref, null); },
  };
}

export function nodes(root: React.ReactNode): Array<React.ReactElement<Record<string, unknown>>> {
  const output: Array<React.ReactElement<Record<string, unknown>>> = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<Record<string, unknown>>(node)) return;
    output.push(node);
    React.Children.forEach(node.props.children as React.ReactNode, visit);
  };
  visit(root);
  return output;
}

export function appStatePort() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.add(listener);
    return { remove: () => { listeners.delete(listener); } };
  });
  return {
    change: (state: AppStateStatus) => { listeners.forEach(listener => listener(state)); },
    close: () => spy.mockRestore(),
  };
}
