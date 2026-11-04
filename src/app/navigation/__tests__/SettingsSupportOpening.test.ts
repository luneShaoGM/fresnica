import { Linking } from 'react-native';
import { openSupportWebsite } from '../SettingsStackNavigator';

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }),
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null, Screen: () => null }));
jest.mock('@features/accounts/AccountDetailsScreen', () => ({ AccountDetailsScreen: () => null }));
jest.mock('@features/accounts/AccountsScreen', () => ({ AccountsScreen: () => null }));
jest.mock('@features/accounts/AddAccountScreen', () => ({ AddAccountScreen: () => null }));
jest.mock('@features/security/SecuritySettingsScreen', () => ({ SecuritySettingsScreen: () => null }));
jest.mock('@features/settings/LanguageSettingsScreen', () => ({ LanguageSettingsScreen: () => null }));

function setup() {
  let rejectOpen: (error: Error) => void = () => {
    throw new Error('promise not initialized');
  };
  const open = new Promise<void>((_, reject) => {
    rejectOpen = reject;
  });
  const originalOpenURL = Linking.openURL;
  Linking.openURL = jest.fn(() => open);
  let focused = true;
  let onBlur: () => void = () => {};
  const unsubscribe = jest.fn();
  const navigate = jest.fn();
  const navigation = {
    isFocused: () => focused,
    addListener: jest.fn((_event: 'blur', callback: () => void) => {
      onBlur = callback;
      return unsubscribe;
    }),
    navigate,
  };
  return {
    navigation,
    navigate,
    unsubscribe,
    blur: () => {
      focused = false;
      onBlur();
    },
    unfocus: () => {
      focused = false;
    },
    refocus: () => {
      focused = true;
    },
    reject: async () => {
      rejectOpen(new Error('browser unavailable'));
      await new Promise(resolve => setImmediate(resolve));
    },
    restore: () => {
      Linking.openURL = originalOpenURL;
    },
  };
}

describe('Settings external support handoff', () => {
  it('shows the fallback only if the originating route remains focused', async () => {
    const t = setup();
    try {
      openSupportWebsite(t.navigation);
      expect(Linking.openURL).toHaveBeenCalledWith('https://fchain.io/');
      await t.reject();
      expect(t.navigate).toHaveBeenCalledWith('support-unavailable');
      expect(t.unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      t.restore();
    }
  });

  it('drops delayed failure after blur, including when user returns before rejection', async () => {
    const t = setup();
    try {
      openSupportWebsite(t.navigation);
      t.blur();
      t.refocus();
      await t.reject();
      expect(t.navigate).not.toHaveBeenCalled();
      expect(t.unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      t.restore();
    }
  });

  it('drops failure if the stack is no longer focused even without a blur event', async () => {
    const t = setup();
    try {
      openSupportWebsite(t.navigation);
      t.unfocus();
      await t.reject();
      expect(t.navigate).not.toHaveBeenCalled();
    } finally {
      t.restore();
    }
  });
});
