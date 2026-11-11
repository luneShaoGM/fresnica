// App access only: no signer, envelope, unlock key or signing authority.
export type SessionAuthenticationPort = Readonly<{
  canAuthenticate: () => Promise<boolean>;
  authenticate: (reason: string, cancelLabel: string) => Promise<boolean>;
  cancel: () => void;
}>;
