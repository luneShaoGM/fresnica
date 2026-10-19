import React from 'react';
import { StateView } from '@fresnica/ui-native';

type Props = Readonly<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: 'empty' | 'error' | 'success';
}>;

// Keep external package APIs behind the Fresnica presentation facade.
export function NativeStateView({ title, description, action, tone = 'empty' }: Props) {
  return <StateView title={title} description={description} action={action} tone={tone} />;
}
