import NetInfo, {type NetInfoState} from '@react-native-community/netinfo';

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

export function subscribeToNetworkRecovery(
  onRecovery: () => void,
  subscribe: NetworkStateSubscriber = listener => NetInfo.addEventListener(listener),
): () => void {
  let lastDefinitive: Exclude<InternetConnectivity, 'unknown'> | undefined;

  return subscribe(state => {
    const current = classifyInternetConnectivity(state);
    if (current === 'unknown') {
      return;
    }
    if (lastDefinitive === 'offline' && current === 'online') {
      onRecovery();
    }
    lastDefinitive = current;
  });
}
