import { NativeModules } from 'react-native';

export type SensitiveClipboard = Readonly<{ copy: (text: string) => Promise<void>; clear: () => void }>;
let nextOwner = 0;
export function createSensitiveClipboard(): SensitiveClipboard {
  const owner = `recovery-${Date.now()}-${++nextOwner}`;
  const module = NativeModules.SensitiveClipboard as
    | {
        copy?: (owner: string, text: string) => Promise<void>;
        clear?: (owner: string) => void;
      }
    | undefined;
  return {
    async copy(text) {
      if (!module?.copy || !module.clear) throw new Error('sensitive-clipboard-unavailable');
      await module.copy(owner, text);
    },
    clear() {
      module?.clear?.(owner);
    },
  };
}
