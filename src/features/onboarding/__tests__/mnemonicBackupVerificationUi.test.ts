import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';

import { MnemonicBackupVerification } from '../MnemonicBackupVerification';
import type { MnemonicBackupVerificationState } from '../mnemonicBackupVerificationState';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return { ...actual, useState: jest.fn() };
});

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string, params?: { position?: number }) => {
      if (key === 'backup.verify.wordLabel') return `Word ${params?.position}`;
      if (key === 'backup.verify.wordAccessibilityLabel') {
        return `Recovery phrase word ${params?.position}`;
      }
      return (
        {
          'backup.verify.title': 'Verify your recovery phrase',
          'backup.verify.body': 'Enter requested words.',
          'backup.verify.wordPlaceholder': 'Enter this word',
          'backup.verify.mismatch': 'One or more words do not match.',
          'backup.verify.showPhrase': 'Show recovery phrase again',
          'backup.verify.submit': 'Verify recovery phrase',
          'backup.verify.presentationHint': 'Verify a few words.',
          'backup.verify.start': 'Verify backup',
        }[key] ?? key
      );
    },
  }),
}));

const mockedUseState = useState as unknown as jest.Mock;
const mnemonic = 'alpha beta gamma delta epsilon zeta golf hotel india juliet kilo lima';

type NodeProps = Readonly<{
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityLiveRegion?: string;
  autoComplete?: string;
  importantForAutofill?: string;
  label?: string;
  placeholder?: string;
  onPress?: () => void;
  value?: string;
}>;

function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function renderChallenge(challenge: MnemonicBackupVerificationState, onVerified = jest.fn()) {
  let call = 0;
  const setState = jest.fn();
  const setCompleting = jest.fn();
  mockedUseState.mockImplementation((initial: unknown) => {
    const response = call === 0 ? [challenge, setState] : call === 1 ? [false, setCompleting] : [initial, jest.fn()];
    call += 1;
    return response;
  });

  return {
    onVerified,
    setState,
    setCompleting,
    root: MnemonicBackupVerification({ mnemonic, onVerified }),
  };
}

describe('MnemonicBackupVerification UI gate', () => {
  beforeEach(() => mockedUseState.mockReset());

  it('does not complete when any requested word is wrong and never exposes expected words in prompts', () => {
    const { root, onVerified, setState } = renderChallenge({
      kind: 'challenge',
      positions: [0, 6, 11],
      answers: ['alpha', 'wrong', 'lima'],
      mismatch: false,
    });
    let submit: React.ReactElement<NodeProps> | undefined;
    const labels: string[] = [];
    const fieldLabels: string[] = [];
    const placeholders: string[] = [];
    const autofillSettings: Array<[string | undefined, string | undefined]> = [];
    const inputValues: string[] = [];

    visit(root, element => {
      if (element.props.label === 'Verify recovery phrase') submit = element;
      if (
        element.type === Text &&
        typeof element.props.children === 'string' &&
        element.props.children.startsWith('Word ')
      ) {
        fieldLabels.push(element.props.children);
      }
      if (element.type === TextInput) {
        labels.push(element.props.accessibilityLabel ?? '');
        placeholders.push(element.props.placeholder ?? '');
        autofillSettings.push([element.props.autoComplete, element.props.importantForAutofill]);
        inputValues.push(element.props.value ?? '');
      }
    });

    submit?.props.onPress?.();

    expect(onVerified).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(expect.objectContaining({ kind: 'challenge', mismatch: true }));
    expect(fieldLabels).toEqual(['Word 1', 'Word 7', 'Word 12']);
    expect(labels).toEqual(['Recovery phrase word 1', 'Recovery phrase word 7', 'Recovery phrase word 12']);
    expect(labels.join(' ')).not.toContain('alpha');
    expect(labels.join(' ')).not.toContain('golf');
    expect(labels.join(' ')).not.toContain('lima');
    expect(fieldLabels.join(' ')).not.toContain('alpha');
    expect(fieldLabels.join(' ')).not.toContain('golf');
    expect(fieldLabels.join(' ')).not.toContain('lima');
    expect(placeholders).toEqual(['Enter this word', 'Enter this word', 'Enter this word']);
    expect(placeholders.join(' ')).not.toContain('alpha');
    expect(placeholders.join(' ')).not.toContain('golf');
    expect(placeholders.join(' ')).not.toContain('lima');
    expect(autofillSettings).toEqual([
      ['off', 'no'],
      ['off', 'no'],
      ['off', 'no'],
    ]);
    expect(inputValues).toEqual(['alpha', 'wrong', 'lima']);
  });

  it('calls completion only after every requested word matches', () => {
    const onVerified = jest.fn();
    const { root, setCompleting } = renderChallenge(
      {
        kind: 'challenge',
        positions: [0, 6, 11],
        answers: [' ALPHA ', 'Golf', 'lima'],
        mismatch: false,
      },
      onVerified,
    );
    let submit: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.props.label === 'Verify recovery phrase') submit = element;
    });

    submit?.props.onPress?.();

    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(setCompleting).toHaveBeenCalledWith(true);
  });

  it('renders mismatch feedback as a live accessibility alert', () => {
    const { root } = renderChallenge({
      kind: 'challenge',
      positions: [0, 6, 11],
      answers: ['alpha', 'wrong', 'lima'],
      mismatch: true,
    });
    let mismatch: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.type === Text && element.props.children === 'One or more words do not match.') {
        mismatch = element;
      }
    });

    expect(mismatch?.props.accessibilityLiveRegion).toBe('assertive');
  });
});
