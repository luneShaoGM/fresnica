import React from 'react';
import {Button, type ButtonProps} from '@fresnica/ui-native';

// Keep external package APIs behind the Fresnica presentation facade.
export function NativeButton(props: ButtonProps) {
  return <Button {...props} />;
}
