export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export type SessionDiagnosticEntry = Readonly<{
  timestamp: string;
  level: DiagnosticLevel;
  event: string;
  sessionId: string;
  correlationId: string;
  details?: unknown;
}>;

export type SessionLoggerOptions = Readonly<{
  now?: () => Date;
  maxEntries?: number;
}>;

export type LogOptions = Readonly<{
  correlationId?: string;
  details?: unknown;
}>;

export class SessionLogger {
  private readonly now: () => Date;
  private readonly maxEntries: number;
  private readonly buffer: SessionDiagnosticEntry[] = [];
  private nextId = 0;
  readonly sessionId: string;

  constructor(options: SessionLoggerOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.maxEntries = Math.max(1, options.maxEntries ?? 200);
    this.sessionId = this.createCorrelationId('session');
  }

  createCorrelationId(scope = 'operation'): string {
    this.nextId += 1;
    return `${scope}-${this.now().getTime().toString(36)}-${this.nextId.toString(36)}`;
  }

  debug(event: string, options?: LogOptions): void {
    this.write('debug', event, options);
  }

  info(event: string, options?: LogOptions): void {
    this.write('info', event, options);
  }

  warn(event: string, options?: LogOptions): void {
    this.write('warn', event, options);
  }

  error(event: string, options?: LogOptions): void {
    this.write('error', event, options);
  }

  entries(): readonly SessionDiagnosticEntry[] {
    return [...this.buffer];
  }

  exportSession(): string {
    return JSON.stringify(
      {
        sessionId: this.sessionId,
        entries: this.buffer,
      },
      null,
      2,
    );
  }

  clear(): void {
    this.buffer.length = 0;
  }

  private write(level: DiagnosticLevel, event: string, options?: LogOptions): void {
    const entry: SessionDiagnosticEntry = {
      timestamp: this.now().toISOString(),
      level,
      event,
      sessionId: this.sessionId,
      correlationId: options?.correlationId ?? this.sessionId,
      ...(options?.details === undefined ? {} : {details: redactDiagnosticValue(options.details)}),
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.splice(0, this.buffer.length - this.maxEntries);
    }
  }
}

const REDACTED = '[REDACTED]';
const STELLAR_SECRET_PATTERN = /\bS[A-Z2-7]{55}\b/g;

export function redactDiagnosticValue(value: unknown): unknown {
  return sanitizeValue(value, new WeakSet<object>());
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    const record = value as Error & {code?: unknown};
    return {
      name: value.name,
      message: redactString(value.message),
      ...(record.code === undefined ? {} : {code: sanitizeValue(record.code, seen)}),
    };
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(child, seen);
  }
  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    normalized.includes('secret') ||
    normalized.includes('mnemonic') ||
    normalized.includes('passphrase') ||
    normalized.includes('passcode') ||
    normalized.includes('unlockkey') ||
    normalized.includes('privatekey') ||
    normalized.includes('envelope') ||
    normalized.includes('xdr') ||
    normalized === 'authorization' ||
    normalized.endsWith('token')
  );
}

function redactString(value: string): string {
  return value.replace(STELLAR_SECRET_PATTERN, REDACTED);
}
