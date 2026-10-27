import React from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';

const MAX_STROOPS = 9_223_372_036_854_775_807n;

export function normalizeSwapAmountInput(value: string): string {
  // Preserve invalid input so a typo cannot silently become a different payment amount.
  if (!/^\d*(?:[.,]\d*)?$/.test(value)) return value;
  const normalized = value.replace(',', '.');
  const [whole, fraction] = normalized.split('.');
  const integer = whole.replace(/^0+(?=\d)/, '') || (fraction === undefined ? '' : '0');
  return fraction === undefined ? integer : `${integer}.${fraction}`;
}

export function isQuotableSwapAmount(value: string): boolean {
  if (value.length > 32) return false;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) return false;
  const stroops = BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  return stroops > 0n && stroops <= MAX_STROOPS;
}

export function SwapAmountInput({
  accessibilityLabel,
  disabled,
  onChangeAmount,
  style,
  value,
}: Readonly<{
  accessibilityLabel: string;
  disabled: boolean;
  onChangeAmount: (value: string) => void;
  style: StyleProp<TextStyle>;
  value: string;
}>) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      autoCorrect={false}
      editable={!disabled}
      keyboardType="decimal-pad"
      onChangeText={next => onChangeAmount(normalizeSwapAmountInput(next))}
      placeholder="0.0000000"
      style={style}
      value={value}
    />
  );
}
