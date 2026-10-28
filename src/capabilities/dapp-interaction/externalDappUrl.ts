// Stage 7 S15: public website origins only. This is NOT a wallet-connection or
// dApp trust attestation. Browser opening happens in the platform layer.
export type UntrustedDappUrl = Readonly<{
  url: string;
  origin: string;
  hostname: string;
}>;

function invalid(): never {
  throw new Error('dapp-url-invalid');
}

function parseUntrustedDappUrl(
  input: string,
  options: Readonly<{ promoteBareDomain: boolean; allowHash: boolean }>,
): UntrustedDappUrl | undefined {
  const raw = input.trim();
  if (
    raw.length === 0 ||
    raw.length > 2048 ||
    /[\s\\\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(raw) ||
    Array.from(raw).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  ) {
    return undefined;
  }

  // A bare public domain may be promoted to HTTPS only at the URL entry.
  // An already supplied scheme other than HTTPS is never rewritten.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https:\/\//i.test(raw)) {
    return undefined;
  }
  const value = /^https:\/\//i.test(raw) ? raw : options.promoteBareDomain ? 'https://' + raw : undefined;
  if (value === undefined) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  const host = parsed.hostname.toLowerCase();
  const labels = host.split('.');
  if (
    parsed.protocol !== 'https:' ||
    !host ||
    !host.includes('.') ||
    host.endsWith('.') ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    (parsed.hash !== '' && !options.allowHash) ||
    // URLs with IP literal hosts may access local devices; using any as a
    // trusted dApp endpoint is deferred to a deliberate network policy.
    /^\d+(?:\.\d+){3}$/.test(host) ||
    host.startsWith('[') ||
    labels.some(label => !/^[a-z0-9-]{1,63}$/.test(label) || label.startsWith('-') || label.endsWith('-')) ||
    ['localhost', 'local', 'internal', 'invalid', 'test', 'onion'].includes(labels[labels.length - 1]) ||
    labels.includes('localhost')
  ) {
    return undefined;
  }
  return Object.freeze({ url: parsed.toString(), origin: parsed.origin, hostname: host });
}

export function normalizeUntrustedDappUrl(input: string): UntrustedDappUrl {
  const parsed = parseUntrustedDappUrl(input, { promoteBareDomain: true, allowHash: false });
  if (!parsed) return invalid();
  return parsed;
}

// In-browser navigations may include a fragment. The typed URL entry still
// rejects fragments so a launch URL cannot carry a secret in the hash.
export function readPublicDappNavigation(input: string): UntrustedDappUrl | undefined {
  return parseUntrustedDappUrl(input, { promoteBareDomain: false, allowHash: true });
}
