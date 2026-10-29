import { Platform } from 'react-native';

// Android WebView's navigation callbacks cannot intercept main-frame POST
// before it is sent. No untrusted page may be mounted there until a genuine
// network-level pre-request policy exists. Device-browser handoff stays usable.
export function canMountDappWebView(): boolean {
  return Platform.OS === 'ios';
}
