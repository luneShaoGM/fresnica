import { readPublicDappNavigation } from './externalDappUrl';
import { MAX_BRIDGE_MESSAGE_LENGTH } from './freighterSession';

export type VerifiedDappMessage = Readonly<{
  data: string;
  origin: string;
}>;

// Native code must supply the WebView-reported main-frame origin. A page URL
// or a value invented by the document is not accepted here.
export function readVerifiedDappMessage(
  input: Readonly<{ data: unknown; sourceOrigin: unknown; isMainFrame: unknown }>,
): VerifiedDappMessage | undefined {
  if (input.isMainFrame !== true || typeof input.sourceOrigin !== 'string' || typeof input.data !== 'string') {
    return undefined;
  }
  if (input.data.length === 0 || input.data.length > MAX_BRIDGE_MESSAGE_LENGTH) {
    return undefined;
  }
  const page = readPublicDappNavigation(input.sourceOrigin);
  if (!page || page.origin !== input.sourceOrigin) return undefined;
  return Object.freeze({ data: input.data, origin: page.origin });
}
