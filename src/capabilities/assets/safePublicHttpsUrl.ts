// Public display resources are not transaction/identity authority.
// No IP literals, local names, credentials, fragments or alternate ports.
export function safePublicHttpsUrl(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length < 12 || input.length > 2048 || input.trim() !== input) return;
  try {
    const value = new URL(input);
    if (
      value.protocol !== 'https:' ||
      value.username !== '' ||
      value.password !== '' ||
      value.hash !== '' ||
      value.port !== ''
    )
      return;
    const host = value.hostname.toLowerCase();
    if (
      host.length < 4 ||
      host.length > 253 ||
      !host.includes('.') ||
      host.includes(':') ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      /\.(?:local|internal|test|invalid|localhost)$/.test(host) ||
      host === 'localhost'
    )
      return;
    const labels = host.split('.');
    if (
      labels.some(label => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ||
      /^\d+$/.test(labels[labels.length - 1] ?? '')
    )
      return;
    return value.toString();
  } catch {
    return;
  }
}
