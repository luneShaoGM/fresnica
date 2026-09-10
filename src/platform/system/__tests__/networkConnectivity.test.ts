jest.mock('@react-native-community/netinfo', () => ({addEventListener: jest.fn()}));

import {
  classifyInternetConnectivity,
  subscribeToNetworkRecovery,
} from '../networkConnectivity';

describe('networkConnectivity', () => {
  it('keeps null reachability unknown instead of treating it as online', () => {
    expect(classifyInternetConnectivity({isConnected: true, isInternetReachable: null})).toBe('unknown');
    expect(classifyInternetConnectivity({isConnected: false, isInternetReachable: null})).toBe('offline');
  });

  it('emits recovery only after a definite offline to online transition', () => {
    const listener = jest.fn();
    let stateListener: ((state: {isConnected: boolean | null; isInternetReachable: boolean | null}) => void) | undefined;
    const unsubscribe = jest.fn();

    const stop = subscribeToNetworkRecovery(listener, callback => {
      stateListener = callback;
      return unsubscribe;
    });

    stateListener?.({isConnected: true, isInternetReachable: null});
    stateListener?.({isConnected: true, isInternetReachable: true});
    expect(listener).not.toHaveBeenCalled();
    stateListener?.({isConnected: false, isInternetReachable: false});
    stateListener?.({isConnected: true, isInternetReachable: null});
    expect(listener).not.toHaveBeenCalled();

    stateListener?.({isConnected: true, isInternetReachable: true});
    expect(listener).toHaveBeenCalledTimes(1);

    stateListener?.({isConnected: true, isInternetReachable: true});
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
