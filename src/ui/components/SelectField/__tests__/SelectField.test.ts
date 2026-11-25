import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Field } from '../../Field';
import { SelectField, type SelectFieldProps } from '../SelectField';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
  useRef: jest.fn(),
  useEffect: jest.fn(),
}));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});

function elements(root: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children as React.ReactNode).flatMap(elements)];
}

function buttons(root: React.ReactNode) {
  return elements(root).filter(node => node.type === Pressable) as React.ReactElement<
    React.ComponentProps<typeof Pressable>
  >[];
}

function harness() {
  const slots: unknown[] = [];
  const pending: (() => void)[] = [];
  const cleanup: (() => void)[] = [];
  let cursor = 0;
  jest.mocked(useState).mockImplementation((initial?: unknown) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [
      slots[index],
      (value: unknown) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      },
    ] as ReturnType<typeof useState>;
  });
  jest.mocked(useRef).mockImplementation((initial?: unknown) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index] as ReturnType<typeof useRef>;
  });
  jest.mocked(useEffect).mockImplementation((effect, deps) => {
    const index = cursor++;
    const previous = slots[index] as readonly unknown[] | undefined;
    if (!previous || deps?.some((value, i) => !Object.is(value, previous[i]))) {
      slots[index] = deps;
      pending.push(() => {
        const dispose = effect();
        if (dispose) cleanup.push(dispose);
      });
    }
  });
  const onValueChange = jest.fn();
  const props: SelectFieldProps<string> = {
    label: 'Asset',
    value: 'one',
    options: [
      { value: 'one', label: 'USD', description: 'GISSUERONE' },
      { value: 'two', label: 'USD', description: 'GISSUERTWO' },
      { value: 'blocked', label: 'Blocked', disabled: true },
    ],
    onValueChange,
    search: { label: 'Search code or issuer', emptyLabel: 'No matching assets' },
  };
  return {
    onValueChange,
    draw(patch: Partial<SelectFieldProps<string>> = {}) {
      Object.assign(props, patch);
      cursor = 0;
      const root = SelectField(props);
      pending.splice(0).forEach(run => run());
      return root;
    },
    unmount() {
      cleanup.forEach(dispose => dispose());
    },
  };
}

it('starts compact and closing without a choice leaves the value untouched', () => {
  const h = harness();
  let root = h.draw();
  expect(buttons(root)).toHaveLength(1);
  expect(buttons(root)[0].props.accessibilityLabel).toBe('Asset: USD, GISSUERONE');
  buttons(root)[0].props.onPress?.({} as never);
  root = h.draw();
  expect(buttons(root)[0].props.accessibilityState?.expanded).toBe(true);
  const oldChoice = buttons(root)[2].props.onPress;
  buttons(root)[0].props.onPress?.({} as never);
  oldChoice?.({} as never);
  expect(buttons(h.draw())).toHaveLength(1);
  expect(h.onValueChange).not.toHaveBeenCalled();
});

it('searches full issuer and selects the exact same-code asset once', () => {
  const h = harness();
  buttons(h.draw())[0].props.onPress?.({} as never);
  let root = h.draw();
  const search = elements(root).find(node => node.type === Field) as React.ReactElement<
    React.ComponentProps<typeof Field>
  >;
  search.props.onChangeText?.('issuertwo');
  root = h.draw();
  const choices = buttons(root).filter(button => button.props.accessibilityRole === 'radio');
  expect(choices).toHaveLength(1);
  expect(choices[0].props.accessibilityLabel).toBe('USD, GISSUERTWO');
  choices[0].props.onPress?.({} as never);
  choices[0].props.onPress?.({} as never);
  expect(h.onValueChange).toHaveBeenCalledTimes(1);
  expect(h.onValueChange).toHaveBeenCalledWith('two');
  expect(buttons(h.draw())).toHaveLength(1);
  buttons(h.draw())[0].props.onPress?.({} as never);
  root = h.draw();
  expect(buttons(root).filter(button => button.props.accessibilityRole === 'radio')).toHaveLength(3);
});

it('reselecting the current option only closes and does not clear a consumer input', () => {
  const h = harness();
  buttons(h.draw())[0].props.onPress?.({} as never);
  const root = h.draw();
  buttons(root)
    .find(button => button.props.accessibilityRole === 'radio' && button.props.accessibilityState?.selected)
    ?.props.onPress?.({} as never);
  expect(h.onValueChange).not.toHaveBeenCalled();
  expect(buttons(h.draw())).toHaveLength(1);
});

it('blocks disabled or removed choices, including a callback captured before disabling', () => {
  const h = harness();
  buttons(h.draw())[0].props.onPress?.({} as never);
  let root = h.draw();
  buttons(root)
    .find(button => button.props.accessibilityLabel === 'Blocked')
    ?.props.onPress?.({} as never);
  expect(h.onValueChange).not.toHaveBeenCalled();
  const staleChoice = buttons(root)[2].props.onPress;
  root = h.draw({ disabled: true });
  expect(buttons(root)).toHaveLength(1);
  expect(buttons(root)[0].props.disabled).toBe(true);
  staleChoice?.({} as never);
  expect(h.onValueChange).not.toHaveBeenCalled();
  buttons(h.draw({ disabled: false }))[0].props.onPress?.({} as never);
  root = h.draw();
  const removedChoice = buttons(root)[2].props.onPress;
  h.draw({ options: [{ value: 'one', label: 'USD', description: 'GISSUERONE' }] });
  removedChoice?.({} as never);
  expect(h.onValueChange).not.toHaveBeenCalled();
});

it('offers an empty search result and lets accessibility escape cancel without selecting', () => {
  const h = harness();
  buttons(h.draw())[0].props.onPress?.({} as never);
  let root = h.draw();
  const search = elements(root).find(node => node.type === Field) as React.ReactElement<
    React.ComponentProps<typeof Field>
  >;
  search.props.onChangeText?.('missing');
  root = h.draw();
  expect(elements(root).some(node => node.type === Text && node.props.children === 'No matching assets')).toBe(true);
  (root as React.ReactElement<React.ComponentProps<typeof View>>).props.onAccessibilityEscape?.();
  expect(buttons(h.draw())).toHaveLength(1);
  expect(h.onValueChange).not.toHaveBeenCalled();
});

it('retires callbacks when the field is unmounted', () => {
  const h = harness();
  buttons(h.draw())[0].props.onPress?.({} as never);
  const root = h.draw();
  h.unmount();
  buttons(root)[2].props.onPress?.({} as never);
  expect(h.onValueChange).not.toHaveBeenCalled();
});
