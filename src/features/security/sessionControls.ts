import { createContext } from 'react';

export const SessionControlsContext = createContext<Readonly<{ canLock: boolean; lock: () => void }> | undefined>(
  undefined,
);
