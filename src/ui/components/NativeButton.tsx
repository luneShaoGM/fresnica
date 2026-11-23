import React, { useContext } from 'react';
import { Button, useUiTheme, type ButtonProps } from '@fresnica/ui-native';

import { FeedbackContext } from '@ui/feedback';

// Keep external package APIs behind the Fresnica presentation facade.
export function NativeButton(props: ButtonProps) {
  const feedback = useContext(FeedbackContext);
  const theme = useUiTheme(props.theme);
  // The library shares its primary token between filled surfaces and quiet text.
  // Only unfilled controls need the app's readable content color on app surfaces.
  const buttonTheme =
    props.variant === 'quiet' || props.variant === 'secondary'
      ? { ...theme, colors: { ...theme.colors, primary: theme.colors.contentPrimary } }
      : props.theme;
  return (
    <Button
      {...props}
      theme={buttonTheme}
      onPress={
        feedback && props.onPress
          ? (...args) => {
              feedback();
              return props.onPress?.(...args);
            }
          : props.onPress
      }
    />
  );
}
