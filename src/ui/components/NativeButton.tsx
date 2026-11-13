import React, { useContext } from 'react';
import { FeedbackContext } from '@ui/feedback';
import {Button, type ButtonProps} from '@fresnica/ui-native';

// Keep external package APIs behind the Fresnica presentation facade.
export function NativeButton(props: ButtonProps) {
  const feedback = useContext(FeedbackContext);
  return <Button {...props} onPress={feedback && props.onPress ? (...args) => { feedback(); return props.onPress?.(...args); } : props.onPress} />;
}
