import { MuxedAccount, StrKey } from '@stellar/stellar-sdk/axios';

/** Valid G address unchanged; valid M address as its embedded G address. */
export function embeddedClassicAddress(address: string): string | undefined {
  if (StrKey.isValidEd25519PublicKey(address)) return address;
  if (!StrKey.isValidMed25519PublicKey(address)) return undefined;
  try {
    return MuxedAccount.fromAddress(address, '0').baseAccount().accountId();
  } catch {
    return undefined;
  }
}
