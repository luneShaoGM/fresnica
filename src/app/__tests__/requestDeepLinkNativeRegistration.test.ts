import fs from 'node:fs';
import path from 'node:path';

describe('request deep-link native registration', () => {
  it('registers web+stellar as a browsable Android VIEW scheme', () => {
    const manifest = fs.readFileSync(path.join(process.cwd(), 'android/app/src/main/AndroidManifest.xml'), 'utf8');
    expect(manifest).toContain('android.intent.action.VIEW');
    expect(manifest).toContain('android.intent.category.BROWSABLE');
    expect(manifest).toContain('android:scheme="web+stellar"');
  });

  it('registers web+stellar in the iOS URL scheme list', () => {
    const info = fs.readFileSync(path.join(process.cwd(), 'ios/Fresnica/Info.plist'), 'utf8');
    expect(info).toContain('<string>web+stellar</string>');
    expect(info).toContain('<key>CFBundleURLTypes</key>');
  });

  it('forwards iOS warm deep links from AppDelegate to React Native Linking', () => {
    const delegate = fs.readFileSync(path.join(process.cwd(), 'ios/Fresnica/AppDelegate.swift'), 'utf8');
    expect(delegate).toMatch(/func application\(_ app: UIApplication, open url: URL, options: \[UIApplication\.OpenURLOptionsKey: Any\]/);
    expect(delegate).toContain('RCTLinkingManager.application(app, open: url, options: options)');
  });
});
