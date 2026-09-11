import { InjectionToken } from '@angular/core';
import type { CorrelationDataset, CorrelationScope } from '../model/correlation';

/**
 * Raw, storage-shaped port. Only `data/` facades and `core/`'s wiring inject this
 * directly — presentation code never does (ADR 0002).
 */
export interface CorrelationDataSource {
  loadEntriesForScope(scope: CorrelationScope): Promise<CorrelationDataset>;
}

export const CORRELATION_DATA_SOURCE = new InjectionToken<CorrelationDataSource>(
  'CorrelationDataSource',
);
