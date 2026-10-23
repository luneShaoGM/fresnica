import React from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';

const MAX_STELLAR_DECIMALS = 7;
const QUOTABLE_AMOUNT = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/;

export function normalizeSwapAmountInput(value: string): string {
  const normalizedSeparator = value.replace(/,/g, '.');
  const digitsAndSeparators = normalizedSeparator.replace(/[^0-9.]/g, '');
  const separatorIndex = digitsAndSeparators.indexOf('.');
  const integerSource =
    separatorIndex === -1 ? digitsAndSeparators : digitsAndSeparators.slice(0, separatorIndex);
  const fractionSource =
    separatorIndex === -1
      ? undefined
      : digitsAndSeparators.slice(separatorIndex + 1).replace(/\./g, '').slice(0, MAX_STELLAR_DECIMALS);
  const integer = integerSource.replace(/^0+(?=\d)/, '') || (separatorIndex === -1 ? '' : '0');
  return fractionSource === undefined ? integer : `${integer}.${fractionSource}`;
}

export function isQuotableSwapAmount(value: string): boolean {
  const match = QUOTABLE_AMOUNT.exec(value);
  if (!match) return false;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0') || '0') > 0n;
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
}>): React.JSX.Element {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      autoCorrect={false}
      editable={!disabled}
      keyboardType="decimal-pad"
      onChangeText={next => onChangeAmount(normalizeSwapAmountInput(next))}
      placeholder="0"
      style={style}
      value={value}
    />
  );
}
