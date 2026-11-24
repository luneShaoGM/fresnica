import React from 'react';
import { TextInput } from 'react-native';
import { MnemonicBackupVerification, type MnemonicBackupVerificationHandle } from '../MnemonicBackupVerification';
import { SensitiveTextInput, type SensitiveTextInputHandle, type SensitiveTextInputProps } from '../SensitiveTextInput';
import { assignRef, nativeField, nodes, renderForwardRef, sensitiveField, SensitiveFlowHarness } from './sensitiveFlowHarness';

export function mnemonicBackupHarness(
  onVerified: () => void | Promise<void>,
  ref?: React.Ref<MnemonicBackupVerificationHandle>,
) {
  const h = new SensitiveFlowHarness();
  const handle = { current: null as MnemonicBackupVerificationHandle | null };
  let root: React.ReactElement;
  let fields: ReturnType<typeof sensitiveField>[] = [];
  let outputs: ReturnType<typeof nativeField>[] = [];
  const render = () => {
    root = h.render(() => renderForwardRef(MnemonicBackupVerification, { onVerified }, handle));
    assignRef(ref, handle.current);
    const all = nodes(root);
    const inputs = all.filter(node => node.type === SensitiveTextInput);
    fields.slice(inputs.length).forEach(field => field.close());
    fields = inputs.map((node, index) => {
      const field = fields[index] ?? sensitiveField(node.props as SensitiveTextInputProps);
      field.render(node.props as SensitiveTextInputProps);
      assignRef(node.props.ref as React.Ref<SensitiveTextInputHandle>, field.handle.current);
      return field;
    });
    const display = all.filter(node => node.type === TextInput);
    outputs.slice(display.length).forEach(output => output.clear());
    outputs = display.map((node, index) => {
      const native = outputs[index] ?? nativeField();
      assignRef(node.props.ref as React.Ref<unknown>, native);
      return native;
    });
    return root;
  };
  const press = (label: string) => {
    const action = nodes(root).find(node => node.props.label === label || (
      label === 'backup.verify.showPhrase' && nodes(node).some(child => child.props.children === label)
      && typeof node.props.onPress === 'function'
    ));
    if (!action) throw new Error(`missing-action:${label}`);
    return (action.props.onPress as () => void | Promise<void>)();
  };
  render();
  return {
    h, handle, render, press,
    root: () => root,
    outputs: () => outputs,
    fields: () => fields,
    async verify(words = ['alpha', 'beta', 'gamma']) {
      press('backup.verify.start');
      render();
      fields.forEach((field, index) => field.type(words[index]));
      render();
      await press('backup.verify.submit');
      render();
    },
    close() {
      h.unmount();
      fields.forEach(field => field.close());
      assignRef(ref, null);
    },
  };
}
