import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {Modal, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import type {ThemeStatusBarContent} from '@ui/theme';

type OverlayOptions = Readonly<{
  statusBarContent?: ThemeStatusBarContent;
}>;

type OverlayEntry = Readonly<{
  id: string;
  content: React.ReactNode;
  statusBarContent?: ThemeStatusBarContent;
}>;

type OverlayContextValue = Readonly<{
  activeOverlayId: string | undefined;
  present: (id: string, content: React.ReactNode, options?: OverlayOptions) => void;
  dismiss: () => void;
}>;

const OverlayContext = createContext<OverlayContextValue | undefined>(undefined);

export function OverlayHost({children}: React.PropsWithChildren) {
  const [overlay, setOverlay] = useState<OverlayEntry | undefined>(undefined);

  const present = useCallback((id: string, content: React.ReactNode, options?: OverlayOptions) => {
    setOverlay({
      id,
      content,
      ...(options?.statusBarContent === undefined
        ? {}
        : {statusBarContent: options.statusBarContent}),
    });
  }, []);

  const dismiss = useCallback(() => {
    setOverlay(undefined);
  }, []);

  const value = useMemo<OverlayContextValue>(
    () => ({activeOverlayId: overlay?.id, present, dismiss}),
    [dismiss, overlay?.id, present],
  );

  return (
    <OverlayContext.Provider value={value}>
      {children}
      <Modal
        animationType="fade"
        onRequestClose={dismiss}
        transparent
        visible={overlay !== undefined}>
        {overlay?.statusBarContent ? (
          <StatusBar
            barStyle={overlay.statusBarContent === 'dark' ? 'dark-content' : 'light-content'}
          />
        ) : null}
        <SafeAreaProvider>{overlay?.content}</SafeAreaProvider>
      </Modal>
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  const value = useContext(OverlayContext);
  if (!value) {
    throw new Error('useOverlay must be used inside OverlayHost');
  }
  return value;
}
