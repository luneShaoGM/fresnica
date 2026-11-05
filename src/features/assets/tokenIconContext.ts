import { createContext } from 'react';

import type { TokenIconPort } from '../../capabilities/assets/TokenIcons';

// Navigation provides the session port without importing presentation widgets.
export const TokenIconContext = createContext<TokenIconPort | undefined>(undefined);
