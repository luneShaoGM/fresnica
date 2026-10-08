export interface RequestDeepLinkPort {
  getInitialUrl(): Promise<string | undefined>;
  subscribe(listener: (url: string) => void): () => void;
}
