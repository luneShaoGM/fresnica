import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type InternetConnectivity = 'online' | 'offline' | 'unknown';

type NetworkState = Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>;
type NetworkStateSubscriber = (listener: (state: NetworkState) => void) => () => void;

export function classifyInternetConnectivity(state: NetworkState): InternetConnectivity {
  if (state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }
  if (state.isConnected === true && state.isInternetReachable === true) {
    return 'online';
  }
  return 'unknown';
}

export function subscribeToInternetConnectivity(
  listener: (state: InternetConnectivity) => void,
  subscribe: NetworkStateSubscriber = callback => NetInfo.addEventListener(callback),
): () => void {
  let active = true;
  let previous: InternetConnectivity | undefined;
  const stop = subscribe(state => {
    const next = classifyInternetConnectivity(state);
    if (!active || next === previous) return;
    previous = next;
    listener(next);
  });
  return () => {
    active = false;
    stop();
  };
}
