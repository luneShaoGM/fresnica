import { normalizeUntrustedDappUrl } from '../externalDappUrl';

describe('S15 custom dApp URL canonical origin and fail-closed external handoff', () => {
  it.each([
    ['example.org', 'https://example.org/', 'https://example.org'],
    ['HTTPS://EXAMPLE.ORG:443/swap?q=2', 'https://example.org/swap?q=2', 'https://example.org'],
    ['https://Example.org:8443/a', 'https://example.org:8443/a', 'https://example.org:8443'],
    ['https://bücher.example/asset', 'https://xn--bcher-kva.example/asset', 'https://xn--bcher-kva.example'],
  ])('normalizes public HTTPS URL %s without promoting it to a reviewed catalog dApp', (value, url, origin) => {
    expect(normalizeUntrustedDappUrl(value)).toEqual({ url, origin, hostname: new URL(url).hostname });
  });

  it.each([
    '',
    ' ',
    'java' + 'script:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'intent://scan/#Intent;scheme=zxing;end',
    'http://example.org',
    'http://www.example.org',
    'https://username:password@example.org',
    'https://username@example.org',
    'https://example.org/#token=secret',
    'https://example.org/?x=1#fragment',
    'https://example.org\\@attacker.org',
    'https://example.org\\path',
    'https://example.org\n.attacker.org',
    'https://example.org:badport',
    'https://',
    'not a host',
    'localhost',
    'http://localhost',
    'https://localhost',
    'https://sub.localhost',
    'https://internal.local',
    'https://host.internal',
    'https://1.2.3.4',
    'https://127.0.0.1',
    'https://192.168.1.2',
    'https://[::1]/',
    'https://0x7f000001',
    'https://example.org.',
    'https://test.invalid',
    'https://example..org',
    'https://-bad.example',
  ])('rejects unsafe or non-web URL %s', value => {
    expect(() => normalizeUntrustedDappUrl(value)).toThrow('dapp-url-invalid');
  });

  it('rejects overlong input and URL space/control separators', () => {
    expect(() => normalizeUntrustedDappUrl('https://example.org/' + 'a'.repeat(2100))).toThrow('dapp-url-invalid');
    expect(() => normalizeUntrustedDappUrl('https://example.org/a b')).toThrow('dapp-url-invalid');
    expect(() => normalizeUntrustedDappUrl('https://example.org/\u202efoo')).toThrow('dapp-url-invalid');
  });

  it('does not equate same-looking subdomain origins', () => {
    expect(normalizeUntrustedDappUrl('https://account.example.org').origin).not.toBe(
      normalizeUntrustedDappUrl('https://example.org').origin,
    );
    expect(normalizeUntrustedDappUrl('https://example.org.evil.example').origin).not.toBe(
      normalizeUntrustedDappUrl('https://example.org').origin,
    );
  });
});
