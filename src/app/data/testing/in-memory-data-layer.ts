import { createIndexedDbPortSet, type PortSet } from '../adapters/indexeddb/adapter-set';
import type { StampContext } from '../adapters/indexeddb/record-meta';
import type { Calendar } from '../model/calendar';
import { InMemoryIdbEngine } from './in-memory-idb-engine';

/**
 * The full set of `data/` ports, as a feature test or the contract suite consumes them.
 * The real repositories are used throughout — only the storage engine underneath is
 * swapped — so a test exercises the same logic production does.
 */
export interface DataLayer extends PortSet {
  readonly engine: InMemoryIdbEngine;
  /** Calendars have no port of their own; tests read them to assert the re-seed. */
  calendars(): Promise<readonly Calendar[]>;
}

export interface InMemoryDataLayerOptions {
  /** Instant of the first write; each subsequent write advances by `stepMs`. */
  readonly start?: string;
  readonly stepMs?: number;
  readonly ownerId?: string;
  readonly userId?: string;
}

export function createInMemoryDataLayer(options: InMemoryDataLayerOptions = {}): DataLayer {
  const engine = new InMemoryIdbEngine();
  const ports = createIndexedDbPortSet(engine, testStampContext(options));

  return {
    ...ports,
    engine,
    calendars: () => engine.getAll<Calendar>('calendars'),
  };
}

/** Monotonic id and clock so creation order is deterministic and assertable. */
function testStampContext(options: InMemoryDataLayerOptions): StampContext {
  const step = options.stepMs ?? 1_000;
  let instant = Date.parse(options.start ?? '2026-01-01T00:00:00.000Z');
  let sequence = 0;

  return {
    ownerId: options.ownerId ?? 'dev',
    userId: options.userId ?? 'dev',
    now: () => {
      const current = new Date(instant).toISOString();
      instant += step;
      return current;
    },
    newId: () => `id-${++sequence}`,
  };
}
