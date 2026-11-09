// S11 public Claimable predicates: bounded, three-valued, and fail closed.
export type ClaimPredicate =
  | Readonly<{ kind: 'always' }>
  | Readonly<{ kind: 'before'; seconds: number; relative: boolean }>
  | Readonly<{ kind: 'not'; child: ClaimPredicate }>
  | Readonly<{ kind: 'and' | 'or'; children: readonly ClaimPredicate[] }>;

export type ClaimAvailability = 'claimable' | 'locked' | 'unclaimable' | 'unknown';

export function parseClaimPredicate(raw: unknown): ClaimPredicate | undefined {
  let visited = 0;
  function parse(value: unknown, depth: number): ClaimPredicate | undefined {
    if (depth > 10 || ++visited > 128 || !value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const fields = value as Record<string, unknown>;
    const keys = Object.keys(fields);
    if (keys.length !== 1) return undefined;
    const key = keys[0];
    if (key === 'unconditional') return fields[key] === true ? { kind: 'always' } : undefined;
    if (key === 'abs_before' || key === 'absBefore' || key === 'rel_before' || key === 'relBefore') {
      const valueSeconds = fields[key];
      if ((typeof valueSeconds !== 'string' && typeof valueSeconds !== 'number') || !/^\d+$/.test(String(valueSeconds)))
        return undefined;
      const seconds = Number(valueSeconds);
      return Number.isSafeInteger(seconds) && seconds >= 0
        ? { kind: 'before', seconds, relative: key.startsWith('rel') }
        : undefined;
    }
    if (key === 'not') {
      const child = parse(fields[key], depth + 1);
      return child ? { kind: 'not', child } : undefined;
    }
    if (key === 'and' || key === 'or') {
      if (!Array.isArray(fields[key]) || fields[key].length < 1 || fields[key].length > 32) return undefined;
      const children = fields[key].map(item => parse(item, depth + 1));
      return children.every(Boolean) ? { kind: key, children: children as ClaimPredicate[] } : undefined;
    }
    return undefined;
  }
  return parse(raw, 0);
}

function truthAt(node: ClaimPredicate, now: number, createdEpoch?: number): boolean | undefined {
  switch (node.kind) {
    case 'always':
      return true;
    case 'before': {
      if (node.relative && createdEpoch === undefined) return undefined;
      return now < node.seconds + (node.relative ? createdEpoch! : 0);
    }
    case 'not': {
      const child = truthAt(node.child, now, createdEpoch);
      return child === undefined ? undefined : !child;
    }
    case 'and': {
      const values = node.children.map(child => truthAt(child, now, createdEpoch));
      return values.includes(false) ? false : values.includes(undefined) ? undefined : true;
    }
    case 'or': {
      const values = node.children.map(child => truthAt(child, now, createdEpoch));
      return values.includes(true) ? true : values.includes(undefined) ? undefined : false;
    }
  }
}

function boundaries(node: ClaimPredicate, createdEpoch?: number): number[] {
  if (node.kind === 'before') {
    if (node.relative && createdEpoch === undefined) return [];
    return [node.seconds + (node.relative ? createdEpoch! : 0)];
  }
  if (node.kind === 'not') return boundaries(node.child, createdEpoch);
  if (node.kind === 'and' || node.kind === 'or') return node.children.flatMap(child => boundaries(child, createdEpoch));
  return [];
}

export function claimAvailability(
  predicate: ClaimPredicate | undefined,
  nowSeconds: number,
  createdEpoch?: number,
): Readonly<{ kind: ClaimAvailability; nextAt?: number }> {
  if (!predicate || !Number.isSafeInteger(nowSeconds)) return { kind: 'unknown' };
  const result = truthAt(predicate, nowSeconds, createdEpoch);
  if (result === undefined) return { kind: 'unknown' };
  const transitions = [...new Set(boundaries(predicate, createdEpoch))]
    .filter(value => Number.isSafeInteger(value) && value > nowSeconds)
    .sort((a, b) => a - b);
  const nextAt = transitions.find(value => truthAt(predicate, value, createdEpoch) !== result);
  if (result) return { kind: 'claimable', ...(nextAt === undefined ? {} : { nextAt }) };
  if (nextAt !== undefined && truthAt(predicate, nextAt, createdEpoch) === true) return { kind: 'locked', nextAt };
  return { kind: 'unclaimable' };
}
