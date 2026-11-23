import type { BridgeResponse } from './freighterSession';

// Platform owns WebView machinery; the Feature owns browsing/permission policy.
export type DappBrowserNavigation = Readonly<{
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}>;

export type DappMessageReplyTarget = Readonly<{ origin: string; documentId: string }>;

export type DappBrowserSurfaceProps = Readonly<{
  url: string;
  nonce: string;
  shouldLoad: (url: string) => boolean;
  onMessage: (data: string, messageUrl: string, documentId?: string) => void;
  onNavigation: (navigation: DappBrowserNavigation) => void;
  onDocumentStart: (url: string) => void;
  onUnavailable?: () => void;
}>;

export type DappBrowserSurfaceHandle = Readonly<{
  reply: (response: BridgeResponse, target?: DappMessageReplyTarget) => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
}>;
