import type {
  AccountIdentity,
  CoreCompatibility,
  ExportedSigningMaterial,
  ExportSigningMaterialInput,
  GeneratedSigner,
  GenerateMnemonicInput,
  ProtectedSigner,
  ProtectMnemonicInput,
  ProtectSecretInput,
  ReprotectInput,
  SignProtectedTransactionInput,
} from './types';

export interface FresnicaCore {
  getCompatibility(): Promise<CoreCompatibility>;
  parseAccount(address: string): Promise<AccountIdentity>;
  generateMnemonic(input: GenerateMnemonicInput): Promise<GeneratedSigner>;
  protectMnemonic(input: ProtectMnemonicInput): Promise<ProtectedSigner>;
  protectSecret(input: ProtectSecretInput): Promise<ProtectedSigner>;
  signProtectedTransaction(
    input: SignProtectedTransactionInput,
  ): Promise<string>;
  reprotect(input: ReprotectInput): Promise<ProtectedSigner>;
  exportSigningMaterial(
    input: ExportSigningMaterialInput,
  ): Promise<ExportedSigningMaterial>;
}
