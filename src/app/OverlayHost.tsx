import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ThemeStatusBarContent } from '@ui/theme';
import { AppModal } from '@ui/components/AppModal';

type OverlayOptions = Readonly<{
  statusBarContent?: ThemeStatusBarContent;
  presentation?: 'sheet';
  closeLabel?: string;
  dragDismissLabel?: string;
}>;

type OverlayEntry = OverlayOptions &
  Readonly<{
    id: string;
    content: React.ReactNode;
  }>;

type OverlayContextValue = Readonly<{
  activeOverlayId: string | undefined;
  present: (id: string, content: React.ReactNode, options?: OverlayOptions) => void;
  dismiss: () => void;
}>;

const OverlayContext = createContext<OverlayContextValue | undefined>(undefined);

export function OverlayHost({ children }: React.PropsWithChildren) {
  const [overlay, setOverlay] = useState<OverlayEntry | undefined>(undefined);
  const [visible, setVisible] = useState(false);

  const present = useCallback((id: string, content: React.ReactNode, options?: OverlayOptions) => {
    setOverlay({
      id,
      content,
      presentation: options?.presentation,
      closeLabel: options?.closeLabel,
      dragDismissLabel: options?.dragDismissLabel,
      ...(options?.statusBarContent === undefined ? {} : { statusBarContent: options.statusBarContent }),
    });
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    // Keep the native modal mounted so its closing transition can finish.
    setVisible(false);
  }, []);

  const value = useMemo<OverlayContextValue>(
    () => ({ activeOverlayId: visible ? overlay?.id : undefined, present, dismiss }),
    [dismiss, overlay?.id, present, visible],
  );

  return (
    <OverlayContext.Provider value={value}>
      {children}
      {overlay?.presentation === 'sheet' ? (
        <AppModal
          visible={visible}
          presentation="sheet"
          animationType="slide"
          contentSized
          swipeToDismiss
          closeLabel={overlay.closeLabel}
          dragDismissLabel={overlay.dragDismissLabel}
          onRequestClose={dismiss}
        >
          {overlay.statusBarContent ? (
            <StatusBar barStyle={overlay.statusBarContent === 'dark' ? 'dark-content' : 'light-content'} />
          ) : null}
          {overlay.content}
        </AppModal>
      ) : (
        <Modal animationType="fade" onRequestClose={dismiss} transparent visible={visible}>
          {overlay?.statusBarContent ? (
            <StatusBar barStyle={overlay.statusBarContent === 'dark' ? 'dark-content' : 'light-content'} />
          ) : null}
          <SafeAreaProvider>{overlay?.content}</SafeAreaProvider>
        </Modal>
      )}
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
