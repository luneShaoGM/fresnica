import {
  FRESNICA_ADAPTER_REQUIREMENTS,
  validateAdapterManifest,
} from '../compatibility';

describe('Fresnica adapter compatibility', () => {
  const validManifest = {
    schemaVersion: 1,
    framework: 'react-native',
    frameworkVersion: '0.87.0',
    adapterSourceVersion: '0.2.0',
    fresnicaNativeSdkVersion: '0.2.0',
    nativeBindingApiVersion: 2,
    jsModuleName: 'FresnicaCore',
  } as const;

  it('pins the exact first-integration versions', () => {
    expect(FRESNICA_ADAPTER_REQUIREMENTS).toEqual(validManifest);
    expect(Object.isFrozen(FRESNICA_ADAPTER_REQUIREMENTS)).toBe(true);
  });

  it('accepts the exact generated adapter manifest contract', () => {
    expect(validateAdapterManifest(validManifest)).toEqual({ ok: true });
  });

  it.each([
    ['frameworkVersion', '0.88.0'],
    ['adapterSourceVersion', '0.2.1'],
    ['fresnicaNativeSdkVersion', '0.2.1'],
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
