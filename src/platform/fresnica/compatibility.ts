export const FRESNICA_ADAPTER_REQUIREMENTS = Object.freeze({
  schemaVersion: 1,
  framework: 'react-native',
  frameworkVersion: '0.87.0',
  adapterSourceVersion: '0.2.0',
  fresnicaNativeSdkVersion: '0.2.1',
  nativeBindingApiVersion: 2,
  jsModuleName: 'FresnicaCore',
} as const);

export type FresnicaAdapterManifest = {
  schemaVersion: number;
  framework: string;
  frameworkVersion: string;
  adapterSourceVersion: string;
  fresnicaNativeSdkVersion: string;
  nativeBindingApiVersion: number;
  jsModuleName: string;
};

export type AdapterManifestValidation =
  | { ok: true }
  | {
      ok: false;
      code: 'adapter-rebuild-required';
      field: keyof typeof FRESNICA_ADAPTER_REQUIREMENTS;
    };

export function validateAdapterManifest(
  manifest: FresnicaAdapterManifest,
): AdapterManifestValidation {
  const fields = Object.keys(FRESNICA_ADAPTER_REQUIREMENTS) as Array<
    keyof typeof FRESNICA_ADAPTER_REQUIREMENTS
  >;

  for (const field of fields) {
    if (manifest[field] !== FRESNICA_ADAPTER_REQUIREMENTS[field]) {
      return { ok: false, code: 'adapter-rebuild-required', field };
    }
  }

  return { ok: true };
}
