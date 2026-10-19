import { createHash } from 'node:crypto';
// @ts-expect-error Node's type-stripping runner requires the explicit source extension.
import { inspectSnapshotSource, type SnapshotSourceBinding } from './report-card-snapshot-readiness.ts';

export type SnapshotValue = null | boolean | number | string | SnapshotValue[] | { [key: string]: SnapshotValue };
export interface SnapshotInput {
  binding: SnapshotSourceBinding;
  // Server-derived complete assessment payload, never client-supplied.
  assessment: SnapshotValue;
}
export interface CanonicalSnapshot {
  format: 'greenfield.report-card.snapshot.v1';
  canonicalJson: string;
  sha256: string;
}

// Strict canonical JSON: sorted object keys, stable array order, no implicit
// JSON.stringify coercion (undefined, NaN, dates, sparse arrays, prototypes).
function normalize(value: unknown, seen: WeakSet<object>): SnapshotValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid snapshot number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') throw new Error('Unsupported snapshot value');
  if (seen.has(value)) throw new Error('Cyclic snapshot value');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length || value.some((_, i) => !Object.hasOwn(value, i))) throw new Error('Sparse or decorated snapshot array');
      return value.map(item => normalize(item, seen));
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error('Non-plain snapshot object');
    const result: Record<string, SnapshotValue> = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('Reserved snapshot key');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error('Snapshot accessor not allowed');
      result[key] = normalize(descriptor.value, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function canonicalizeReportSnapshot(input: SnapshotInput): CanonicalSnapshot {
  const readiness = inspectSnapshotSource(input.binding);
  if (!readiness.ready) throw new Error(`Snapshot source not ready: ${readiness.reason}`);
  // Explicitly sort sets: subject order and source version order must not
  // influence the digest; assessment arrays retain their meaningful order.
  const binding = {
    ...input.binding,
    subjectIds: [...input.binding.subjectIds].sort(),
    finalizedSubjectIds: [...input.binding.finalizedSubjectIds].sort(),
    sourceVersionKeys: [...input.binding.sourceVersionKeys].sort(),
  };
  const payload = normalize({
    format: 'greenfield.report-card.snapshot.v1',
    binding,
    assessment: input.assessment,
  }, new WeakSet());
  const canonicalJson = JSON.stringify(payload);
  return {
    format: 'greenfield.report-card.snapshot.v1',
    canonicalJson,
    sha256: createHash('sha256').update(canonicalJson, 'utf8').digest('hex'),
  };
}
