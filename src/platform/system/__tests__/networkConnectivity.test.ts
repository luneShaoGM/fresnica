jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn() }));

import { classifyInternetConnectivity, subscribeToInternetConnectivity } from '../networkConnectivity';

describe('networkConnectivity', () => {
  it('keeps null reachability unknown instead of treating it as online', () => {
    expect(classifyInternetConnectivity({ isConnected: true, isInternetReachable: null })).toBe('unknown');
    expect(classifyInternetConnectivity({ isConnected: false, isInternetReachable: null })).toBe('offline');
  });

  it('delivers initial connectivity, deduplicates states, and ignores queued callbacks after disposal', () => {
    const listener = jest.fn();
    let stateListener!: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
    const unsubscribe = jest.fn();
    const stop = subscribeToInternetConnectivity(listener, callback => {
      stateListener = callback;
      return unsubscribe;
    });
    stateListener({ isConnected: true, isInternetReachable: null });
    stateListener({ isConnected: true, isInternetReachable: true });
    stateListener({ isConnected: true, isInternetReachable: true });
    stateListener({ isConnected: true, isInternetReachable: false });
    expect(listener.mock.calls).toEqual([['unknown'], ['online'], ['offline']]);
    stop();
    stateListener({ isConnected: true, isInternetReachable: true });
    expect(listener).toHaveBeenCalledTimes(3);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
