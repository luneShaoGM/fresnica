export type RequestShareResult = 'shared' | 'cancelled';

export interface RequestOutputPort {
  copyRequestUri(uri: string): Promise<void>;
  shareRequestUri(uri: string): Promise<RequestShareResult>;
}
