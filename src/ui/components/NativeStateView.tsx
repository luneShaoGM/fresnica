import React from 'react';
import {StateView} from '@fresnica/ui-native';

type Props = Readonly<{
  title: string;
  tone?: 'empty' | 'error' | 'success';
}>;

// Keep external package APIs behind the Fresnica presentation facade.
export function NativeStateView({title, tone = 'empty'}: Props) {
  return <StateView title={title} tone={tone} />;
}
