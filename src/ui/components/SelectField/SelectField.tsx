import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useThemedStyles } from '@ui/theme';

import { Field } from '../Field';
import { createStyles } from './styles';

export type SelectOption<Value extends string> = Readonly<{
  value: Value;
  label: string;
  description?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}>;

export type SelectFieldProps<Value extends string> = Readonly<{
  label: string;
  value: Value;
  options: readonly SelectOption<Value>[];
  onValueChange: (value: Value) => void;
  disabled?: boolean;
  placeholder?: string;
  search?: Readonly<{ label: string; emptyLabel: string }>;
}>;

/** Expands inside the existing page or sheet without opening another native modal. */
export function SelectField<Value extends string>({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  placeholder = '',
  search,
}: SelectFieldProps<Value>): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const open = useRef(false);
  const current = useRef({ value, options, onValueChange, disabled });
  current.current = { value, options, onValueChange, disabled };
  const selected = options.find(option => option.value === value);
  const visible = expanded && !disabled;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = options.filter(
    option => !search || `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const close = () => {
    open.current = false;
    setExpanded(false);
    setQuery('');
  };

  useEffect(() => {
    close();
  }, [disabled, value]);

  useEffect(
    () => () => {
      open.current = false;
    },
    [],
  );

  const select = (option: SelectOption<Value>) => {
    const latest = current.current;
    const available = latest.options.find(item => item.value === option.value);
    if (!open.current || latest.disabled || !available || available.disabled) return;
    close();
    if (option.value !== latest.value) latest.onValueChange(option.value);
  };

  return (
    <View style={styles.field} onAccessibilityEscape={visible ? close : undefined}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          label,
          selected?.accessibilityLabel ??
            [selected?.label ?? placeholder, selected?.description].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join(': ')}
        accessibilityState={{ expanded: visible, disabled }}
        disabled={disabled}
        onPress={() => {
          if (current.current.disabled) return;
          if (open.current) close();
          else {
            open.current = true;
            setExpanded(true);
          }
        }}
        style={({ pressed }) => [
          styles.trigger,
          disabled ? styles.disabled : undefined,
          pressed ? styles.pressed : undefined,
        ]}
      >
        <View style={styles.copy}>
          <Text style={styles.value}>{selected?.label ?? placeholder}</Text>
          {selected?.description ? <Text style={styles.description}>{selected.description}</Text> : null}
        </View>
        <Text accessible={false} allowFontScaling={false} style={styles.chevron}>
          {visible ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {visible ? (
        <View style={styles.options}>
          {search ? (
            <Field
              label={search.label}
              accessibilityLabel={search.label}
              autoCapitalize="none"
              autoCorrect={false}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
          ) : null}
          {matches.map(option => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={
                  option.accessibilityLabel ?? [option.label, option.description].filter(Boolean).join(', ')
                }
                accessibilityState={{ selected: isSelected, disabled: option.disabled === true }}
                disabled={option.disabled}
                onPress={() => select(option)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected ? styles.selected : undefined,
                  option.disabled ? styles.disabled : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <View style={styles.copy}>
                  <Text style={[styles.value, isSelected ? styles.selectedText : undefined]}>{option.label}</Text>
                  {option.description ? (
                    <Text style={[styles.description, isSelected ? styles.selectedText : undefined]}>
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? (
                  <Text accessible={false} style={styles.selectedText}>
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {search && matches.length === 0 ? <Text style={styles.description}>{search.emptyLabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
