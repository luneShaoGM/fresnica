import React from 'react';
import {Field, type FieldProps} from '@fresnica/ui-native';

// Keep external package APIs behind the Fresnica presentation facade.
export function NativeField(props: FieldProps) {
  return <Field {...props} />;
}
