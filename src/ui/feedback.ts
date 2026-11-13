import { createContext } from 'react';
export const FeedbackContext = createContext<(() => void) | undefined>(undefined);
