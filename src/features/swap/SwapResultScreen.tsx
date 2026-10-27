import React, { useEffect, useRef, useState } from 'react';
import type { AccountRecord } from '@capabilities/account/types';
import { transactionExplorerUrl } from '@capabilities/network/transactionExplorer';
import type { SubmitReviewedTransactionResult } from '@capabilities/transaction/submitReviewedTransaction';
import { TransactionResult, type TransactionResultDetail, type TransactionResultTone } from '@ui/components';
import { useLocalization } from '../../locale';

export type SwapTerminalResult = Exclude<SubmitReviewedTransactionResult, { status: 'passphrase-required' }>;
const tones: Record<SwapTerminalResult['status'], TransactionResultTone> = {
  submitted: 'success',
  uncertain: 'unverified',
  rejected: 'failed',
  'authorization-blocked': 'failed',
  'unsupported-signer': 'failed',
};
type Props = React.PropsWithChildren<
  Readonly<{
    account: AccountRecord;
    result: SwapTerminalResult;
    captureSession: () => () => boolean;
    copyPublicText: (value: string) => Promise<void>;
    openExternalUrl: (url: string) => Promise<void>;
    onDone: () => void;
  }>
>;

export function SwapResultScreen({
  account,
  result,
  captureSession,
  copyPublicText,
  openExternalUrl,
  onDone,
  children,
}: Props) {
  const { t } = useLocalization();
  const [output, setOutput] = useState<'idle' | 'busy' | 'copied' | 'failed'>('idle');
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const hash = 'hash' in result ? result.hash : 'transactionHash' in result ? result.transactionHash : undefined;
  const explorer = hash ? transactionExplorerUrl(account.networkId, hash) : undefined;
  const details: TransactionResultDetail[] = [{ label: t('swap.preview.account'), value: account.address }];
  if (hash) details.push({ label: t('swap.history.hash'), value: hash });
  if (result.status === 'submitted') {
    if (result.ledger !== undefined) details.push({ label: t('swap.history.ledger'), value: String(result.ledger) });
    details.push({ label: t('swap.execution.authorization'), value: result.authorization });
  }
  if (result.status === 'rejected' && result.resultCode)
    details.push({ label: t('swap.result.code'), value: result.resultCode });
  if (result.status === 'authorization-blocked') details.push({ label: t('swap.result.reason'), value: result.reason });

  const runOutput = async (action: () => Promise<void>, next: 'idle' | 'copied') => {
    if (locked.current || !mounted.current) return;
    const current = captureSession();
    if (!current()) return;
    locked.current = true;
    setOutput('busy');
    try {
      await action();
      if (mounted.current && current()) setOutput(next);
    } catch {
      if (mounted.current && current()) setOutput('failed');
    } finally {
      locked.current = false;
    }
  };

  return (
    <TransactionResult
      tone={tones[result.status]}
      title={t('swap.result.' + result.status)}
      subtitle={t('swap.result.description.' + result.status)}
      details={details}
      notice={output === 'failed' ? t('swap.result.outputError') : undefined}
      actions={[
        ...(hash
          ? [
              {
                label: t(output === 'copied' ? 'swap.result.copiedHash' : 'swap.result.copyHash'),
                disabled: output === 'busy',
                onPress: () => {
                  void runOutput(() => copyPublicText(hash), 'copied');
                },
              },
            ]
          : []),
        ...(explorer
          ? [
              {
                label: t('activity.detail.explorer.open'),
                disabled: output === 'busy',
                onPress: () => {
                  void runOutput(() => openExternalUrl(explorer), 'idle');
                },
              },
            ]
          : []),
      ]}
      primaryAction={{ label: t('swap.preview.done'), onPress: onDone }}
    >
      {children}
    </TransactionResult>
  );
}
