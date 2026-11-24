import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import type { BalanceLine } from '@capabilities/balance/types';
import { walletAssetKey } from '@capabilities/assets/walletAssetIdentity';
import { loadPortfolioReference, type PortfolioReference } from '@capabilities/valuation/portfolioReference';
import type { CreditFiatQuotePort } from '@capabilities/valuation/creditFiatQuote';
import type { XlmQuotePort } from '@capabilities/valuation/xlmQuote';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './styles';

export function PortfolioReferenceEstimate({
  lines,
  xlm,
  credit,
  active,
}: Readonly<{
  lines: readonly BalanceLine[];
  xlm: XlmQuotePort;
  credit: CreditFiatQuotePort;
  active: boolean;
}>) {
  const { t, displayPreferences, formatNumber } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const currency = displayPreferences?.currency ?? 'USD';
  const context = useMemo(() => ({ lines, xlm, credit, active, currency }), [lines, xlm, credit, active, currency]);
  const contextRef = useRef(context);
  contextRef.current = context;
  const [result, setResult] = useState<Readonly<{ context: typeof context; value: PortfolioReference }>>();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const request = useRef<AbortController | undefined>(undefined);
  const expiry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clear = () => {
    request.current?.abort();
    request.current = undefined;
    if (expiry.current) clearTimeout(expiry.current);
    if (deadline.current) clearTimeout(deadline.current);
    expiry.current = undefined;
    deadline.current = undefined;
    setResult(undefined);
    setPhase('idle');
  };
  useEffect(() => {
    clear();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') clear();
    });
    return () => {
      request.current?.abort();
      request.current = undefined;
      if (expiry.current) clearTimeout(expiry.current);
      if (deadline.current) clearTimeout(deadline.current);
      subscription.remove();
    };
  }, [active, lines, xlm, credit, currency]);
  if (!active) return null;
  const load = () => {
    if (contextRef.current !== context || !context.active || request.current || AppState.currentState !== 'active')
      return;
    if (expiry.current) clearTimeout(expiry.current);
    const owner = new AbortController();
    request.current = owner;
    setResult(undefined);
    setPhase('loading');
    const timer = setTimeout(() => {
      if (request.current !== owner) return;
      owner.abort();
      request.current = undefined;
      setPhase('error');
    }, 15_000);
    deadline.current = timer;
    loadPortfolioReference(lines, 'stellar-mainnet', currency, { xlm, credit }, owner.signal)
      .then(value => {
        if (
          contextRef.current !== context ||
          request.current !== owner ||
          owner.signal.aborted ||
          AppState.currentState !== 'active'
        )
          return;
        setResult({ context, value });
        setPhase('idle');
        expiry.current = setTimeout(clear, Math.max(0, value.expiresAt - Date.now()));
      })
      .catch(() => {
        if (contextRef.current !== context || request.current !== owner || owner.signal.aborted) return;
        setPhase('error');
      })
      .finally(() => {
        clearTimeout(timer);
        if (deadline.current === timer) deadline.current = undefined;
        if (request.current === owner) request.current = undefined;
      });
  };
  const priced =
    result?.context === context && AppState.currentState === 'active' && Date.now() < result.value.expiresAt
      ? result.value
      : undefined;
  const noPrice = priced?.missing.filter(item => item.reason === 'no-price').length ?? 0;
  const budget = priced?.missing.filter(item => item.reason === 'budget').length ?? 0;
  const invalid = priced?.missing.filter(item => item.reason === 'invalid').length ?? 0;
  return (
    <View style={styles.portfolioBox}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: phase === 'loading' }}
        onPress={load}
        disabled={phase === 'loading'}
        style={styles.portfolioButton}
      >
        <Text style={styles.portfolioLabel}>{t('assets.portfolio.action')}</Text>
      </Pressable>
      {phase === 'loading' ? <Text style={styles.portfolioHint}>{t('assets.portfolio.loading')}</Text> : null}
      {phase === 'error' ? (
        <Text accessibilityRole="alert" style={styles.portfolioHint}>
          {t('assets.portfolio.error')}
        </Text>
      ) : null}
      {priced ? (
        <>
          {priced.cents !== undefined ? (
            <Text style={styles.portfolioValue}>
              ≈ {formatNumber(priced.cents, 2)} {currency}
            </Text>
          ) : (
            <Text style={styles.portfolioHint}>{t('assets.portfolio.noValue')}</Text>
          )}
          <Text style={styles.portfolioHint}>
            {priced.covered}/{priced.total} {t('assets.portfolio.coverage')}
            {priced.missing.length ? ` · ${t('assets.portfolio.partial')}` : ''}
          </Text>
          {noPrice ? (
            <Text style={styles.portfolioHint}>
              {noPrice} {t('assets.portfolio.noPrice')}
            </Text>
          ) : null}
          {budget ? (
            <Text style={styles.portfolioHint}>
              {budget} {t('assets.portfolio.budget')}
            </Text>
          ) : null}
          {invalid ? (
            <Text style={styles.portfolioHint}>
              {invalid} {t('assets.portfolio.invalid')}
            </Text>
          ) : null}
          {priced.missing.slice(0, 8).map(item => {
            const line = lines.find(candidate => walletAssetKey('stellar-mainnet', candidate.asset) === item.key);
            const identity = line?.asset.kind === 'credit' ? `${line.asset.code} · ${line.asset.issuer}` : 'XLM';
            const reason = item.reason === 'budget' ? 'budget' : item.reason === 'invalid' ? 'invalid' : 'noPrice';
            return (
              <Text key={item.key} selectable style={styles.portfolioHint}>
                {identity}: {t(`assets.portfolio.${reason}`)}
              </Text>
            );
          })}
          <Text style={styles.portfolioHint}>{t('assets.portfolio.scope')}</Text>
        </>
      ) : null}
    </View>
  );
}
