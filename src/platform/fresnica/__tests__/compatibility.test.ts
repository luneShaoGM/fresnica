import {
  FRESNICA_ADAPTER_REQUIREMENTS,
  FRESNICA_SDK_COMPATIBILITY,
  validateAdapterManifest,
} from '../compatibility';

describe('Fresnica adapter compatibility', () => {
  const validManifest = {
    schemaVersion: 1,
    framework: 'react-native',
    frameworkVersion: '0.87.0',
    adapterSourceVersion: '0.2.1',
    fresnicaNativeSdkVersion: '0.2.1',
    nativeBindingApiVersion: 2,
    jsModuleName: 'FresnicaCore',
  } as const;

  it('records every separately versioned Mobile consumer contract', () => {
    expect(FRESNICA_SDK_COMPATIBILITY).toEqual({
      nativeSdkVersion: '0.2.1',
      nativeBindingApiVersion: 2,
      universalSdkApiVersion: 3,
      coreClientApiVersion: 3,
      adapterSourceVersion: '0.2.1',
      adapterSourceRevision: '47383bd94b1f88882dd0759f7275bd8b5452dcdb',
      reactNativeVersion: '0.87.0',
    });
    expect(Object.isFrozen(FRESNICA_SDK_COMPATIBILITY)).toBe(true);
  });

  it('pins the exact first-integration adapter manifest contract', () => {
    expect(FRESNICA_ADAPTER_REQUIREMENTS).toEqual(validManifest);
    expect(Object.isFrozen(FRESNICA_ADAPTER_REQUIREMENTS)).toBe(true);
  });

  it('accepts the exact generated adapter manifest contract', () => {
    expect(validateAdapterManifest(validManifest)).toEqual({ ok: true });
  });

  it.each([
    ['frameworkVersion', '0.88.0'],
    ['adapterSourceVersion', '0.2.0'],
    ['fresnicaNativeSdkVersion', '0.2.0'],
    ['nativeBindingApiVersion', 3],
    ['jsModuleName', 'OtherModule'],
  ] as const)('rejects a %s mismatch', (field, value) => {
    const result = validateAdapterManifest({
      ...validManifest,
      [field]: value,
    });

    expect(result).toEqual({
      ok: false,
      code: 'adapter-rebuild-required',
      field,
    });
  });
});
