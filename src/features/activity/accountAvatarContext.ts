import { createContext } from 'react';
import type { AccountAvatarPort } from '@capabilities/contacts/AccountAvatars';
export const AccountAvatarContext = createContext<AccountAvatarPort | undefined>(undefined);
