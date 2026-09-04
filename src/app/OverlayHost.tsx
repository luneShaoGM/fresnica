import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {Modal} from 'react-native';

type OverlayEntry = Readonly<{
  id: string;
  content: React.ReactNode;
}>;

type OverlayContextValue = Readonly<{
  activeOverlayId: string | undefined;
  present: (id: string, content: React.ReactNode) => void;
  dismiss: () => void;
}>;

const OverlayContext = createContext<OverlayContextValue | undefined>(undefined);

export function OverlayHost({children}: React.PropsWithChildren) {
  const [overlay, setOverlay] = useState<OverlayEntry | undefined>(undefined);

  const present = useCallback((id: string, content: React.ReactNode) => {
    setOverlay({id, content});
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
        {overlay?.content}
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
