import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { TypeScriptParser } = require('@react-native/codegen/lib/parsers/typescript/parser');
const { generate } = require('@react-native/codegen/lib/generators/components/GenerateEventEmitterCpp');
const { generate: generateHeader } = require('@react-native/codegen/lib/generators/components/GenerateEventEmitterH');
const webview = resolve(import.meta.dirname, '../node_modules/react-native-webview');

test('iOS Fabric emits verified WebView origin, main-frame flag and native SEP-53 reply lifetime to JS', () => {
  const schema = new TypeScriptParser().parseFile(resolve(webview, 'src/RNCWebViewNativeComponent.ts'));
  const emitter = generate('RNCWebViewSpec', schema).get('EventEmitters.cpp');
  const header = generateHeader('RNCWebViewSpec', schema).get('EventEmitters.h');
  assert.match(header, /struct OnMessage \{[^}]*bool sep53ReplyExpired;/, 'Expiry must remain a native boolean');
  const event = emitter.match(/::onMessage\(OnMessage event\)[\s\S]*?\n}/)?.[0];
  assert.ok(event, 'Codegen must generate the native message event');

  const implementation = readFileSync(resolve(webview, 'apple/RNCWebView.mm'), 'utf8');
  const mapping = implementation.match(/::OnMessage data = \{([\s\S]*?)\};/)?.[1];
  assert.ok(mapping, 'The WebView Fabric component must construct the message event');

  for (const name of ['sourceOrigin', 'isMainFrame', 'sep53ReplyId', 'sep53ReplyExpiresAt', 'sep53ReplyExpired']) {
    assert.ok(event.includes(`payload.setProperty(runtime, "${name}", event.${name})`), `Event drops ${name}`);
    assert.match(
      mapping,
      new RegExp(`\\.${name} = [^\\n]*\\[dictionary valueForKey:@"${name}"\\]`),
      `Fabric mapping drops ${name}`,
    );
  }
});
