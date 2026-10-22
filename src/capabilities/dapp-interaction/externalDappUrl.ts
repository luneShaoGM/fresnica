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

export function normalizeUntrustedDappUrl(input: string): UntrustedDappUrl {
  const raw = input.trim();
  if (
    raw.length === 0 ||
    raw.length > 2048 ||
    /[\s\\\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(raw) ||
    Array.from(raw).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  ) {
    return invalid();
  }

  // UX: a bare public domain may be promoted to HTTPS, never a supplied
  // alternative scheme, pseudo-URL or URI containing credentials.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https:\/\//i.test(raw)) {
    return invalid();
  }
  const value = /^https:\/\//i.test(raw) ? raw : 'https://' + raw;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return invalid();
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
    parsed.hash !== '' ||
    // URLs with IP literal hosts may access local devices; using any as a
    // trusted dApp endpoint is deferred to a deliberate network policy.
    /^\d+(?:\.\d+){3}$/.test(host) ||
    host.startsWith('[') ||
    labels.some(label => !/^[a-z0-9-]{1,63}$/.test(label) || label.startsWith('-') || label.endsWith('-')) ||
    ['localhost', 'local', 'internal', 'invalid', 'test', 'onion'].includes(labels[labels.length - 1]) ||
    labels.includes('localhost')
  ) {
    return invalid();
  }
  return Object.freeze({ url: parsed.toString(), origin: parsed.origin, hostname: host });
}
