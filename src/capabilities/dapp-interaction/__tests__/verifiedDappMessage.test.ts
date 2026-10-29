import { MAX_BRIDGE_MESSAGE_LENGTH } from '../freighterSession';
import { readVerifiedDappMessage } from '../verifiedDappMessage';

const origin = 'https://demo.example.org';

describe('verified dApp bridge messages', () => {
  it('accepts a main-frame public HTTPS origin and its payload', () => {
    expect(
      readVerifiedDappMessage({
        data: '{"type":"REQUEST_ACCESS"}',
        sourceOrigin: origin,
        isMainFrame: true,
      }),
    ).toEqual({ data: '{"type":"REQUEST_ACCESS"}', origin });
  });

  it.each([
    { data: '{"ok":true}', sourceOrigin: origin, isMainFrame: false },
    { data: '{"ok":true}', sourceOrigin: origin, isMainFrame: undefined },
    { data: '{"ok":true}', sourceOrigin: 'http://demo.example.org', isMainFrame: true },
    { data: '{"ok":true}', sourceOrigin: 'https://127.0.0.1', isMainFrame: true },
    { data: '{"ok":true}', sourceOrigin: 'https://localhost', isMainFrame: true },
    { data: '{"ok":true}', sourceOrigin: 'https://demo.example.org/app', isMainFrame: true },
    { data: '{"ok":true}', sourceOrigin: 'https://EXAMPLE.example.org', isMainFrame: true },
    { data: '', sourceOrigin: origin, isMainFrame: true },
    { data: 'x'.repeat(MAX_BRIDGE_MESSAGE_LENGTH + 1), sourceOrigin: origin, isMainFrame: true },
    { data: 1, sourceOrigin: origin, isMainFrame: true },
  ])('drops an unverified bridge message %j', input => {
    expect(readVerifiedDappMessage(input)).toBeUndefined();
  });
});
