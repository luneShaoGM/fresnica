import type { BridgeResponse, DappNotificationResponse } from './freighterSession';

// Platform owns WebView machinery; the Feature owns browsing/permission policy.
export type DappBrowserNavigation = Readonly<{
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}>;

export type DappMessageReplyTarget = Readonly<{ replyId: string; expiresAt?: number }>;

export type DappBrowserSurfaceProps = Readonly<{
  url: string;
  nonce: string;
  shouldLoad: (url: string) => boolean;
  onMessage: (
    data: string,
    messageUrl: string,
    replyId?: string,
    replyExpiresAt?: number,
    firstCommittedDocumentUrl?: string,
  ) => void;
  onReplyExpired?: (replyId: string, origin: string) => void;
  onNavigation: (navigation: DappBrowserNavigation) => void;
  onDocumentStart: (url: string) => void;
  onUnavailable?: () => void;
}>;

export type DappBrowserSurfaceHandle = Readonly<{
  reply: (response: BridgeResponse | DappNotificationResponse, target?: DappMessageReplyTarget) => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
}>;
