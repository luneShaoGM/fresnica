const UNIT = 10_000_000n;

export function formatSwapRate(sourceAmount: string, destinationAmount: string): string {
  const source = parseAmount(sourceAmount);
  const destination = parseAmount(destinationAmount);
  if (source <= 0n) return '—';
  const scaled = (destination * UNIT) / source;
  return formatAmount(scaled);
}

export function parseSlippagePermille(value: string): number | undefined {
  if (!/^(0|[1-9]\d{0,2})$/.test(value.trim())) return undefined;
  const permille = Number(value);
  return permille >= 1 && permille <= 100 ? permille * 10 : undefined;
}

export function normalizeSlippagePermille(value: string, fallback: string): string {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return String(Math.min(Math.max(parsed, 1), 100));
}

export function formatSlippagePermille(bps: number): string {
  if (!Number.isInteger(bps) || bps < 0 || bps > 1000) return '—';
  const whole = Math.floor(bps / 10);
  const fraction = bps % 10;
  return fraction ? `${whole}.${fraction}‰` : `${whole}‰`;
}

function parseAmount(value: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) return 0n;
  return BigInt(match[1]) * UNIT + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
}

function formatAmount(value: bigint): string {
  const whole = value / UNIT;
  const fraction = String(value % UNIT).padStart(7, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}
