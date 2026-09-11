import { Injectable, InjectionToken, inject } from '@angular/core';
import type { Uuid } from '../../data/model/common';
import { CORRELATION_DATA_SOURCE } from '../../data/ports/correlation-data-source';
import type { BucketSize } from './bucketing';
import { pointBiserialCorrelation, spearmanCorrelation, type CorrelationResult } from './correlation-stats';
import {
  generateSignals,
  runDiscovery,
  type DiscoveryCandidate,
  type DiscoveryGuardrails,
  type TaggedSignal,
} from './discovery';
import { pairSignalsAtLag, scanLags, type LagRange } from './lag-scan';

export interface CorrelationScanInput {
  readonly from: string;
  readonly to: string;
  readonly trackerIds: readonly Uuid[] | 'all';
  readonly bucketSize: BucketSize;
  readonly lagRange: LagRange;
  readonly guardrails: DiscoveryGuardrails;
}

export interface DirectedViewPoint {
  readonly bucketKey: string;
  readonly a: number;
  readonly b: number;
}

export interface DirectedViewData {
  readonly signalA: TaggedSignal;
  readonly signalB: TaggedSignal;
  readonly lag: number;
  readonly result: CorrelationResult | null;
  readonly scatter: readonly DirectedViewPoint[];
}

/**
 * Feature-local facade (ADR 0002): the Correlation page's only way to reach
 * `CorrelationDataSource` — the pure `bucketing`/`signal-extraction`/`correlation-stats`
 * /`lag-scan`/`discovery`/`significance` modules do the actual work; this wires them to
 * live data for the Discovery scan and the Directed view (manual pair or drill-in).
 */
export interface CorrelationFacade {
  runScan(input: CorrelationScanInput, isCancelled?: () => boolean): Promise<readonly DiscoveryCandidate[]>;
  /** Resolves to `null` if either named Signal doesn't exist in the current scope. */
  directedView(
    input: CorrelationScanInput,
    signalAName: string,
    signalBName: string,
    lag: number,
  ): Promise<DirectedViewData | null>;
}

export const CORRELATION_FACADE = new InjectionToken<CorrelationFacade>('CorrelationFacade');

@Injectable()
export class CorrelationFacadeService implements CorrelationFacade {
  private readonly dataSource = inject(CORRELATION_DATA_SOURCE);

  async runScan(input: CorrelationScanInput, isCancelled?: () => boolean): Promise<readonly DiscoveryCandidate[]> {
    const signals = await this.loadSignals(input);
    return runDiscovery(signals, {
      bucketSize: input.bucketSize,
      lagRange: input.lagRange,
      guardrails: input.guardrails,
      isCancelled,
    });
  }

  async directedView(
    input: CorrelationScanInput,
    signalAName: string,
    signalBName: string,
    lag: number,
  ): Promise<DirectedViewData | null> {
    const signals = await this.loadSignals(input);
    const signalA = signals.find((signal) => signal.name === signalAName);
    const signalB = signals.find((signal) => signal.name === signalBName);
    if (!signalA || !signalB) {
      return null;
    }

    const method =
      signalA.kind === 'numeric' && signalB.kind === 'numeric' ? spearmanCorrelation : pointBiserialCorrelation;
    const scan = scanLags(signalA, signalB, input.bucketSize, { min: lag, max: lag }, method);
    const { a, b, bucketKeys } = pairSignalsAtLag(signalA.points, signalB.points, input.bucketSize, lag);

    return {
      signalA,
      signalB,
      lag,
      result: scan.bestResult,
      scatter: bucketKeys.map((bucketKey, index) => ({ bucketKey, a: a[index], b: b[index] })),
    };
  }

  private async loadSignals(input: CorrelationScanInput): Promise<readonly TaggedSignal[]> {
    const dataset = await this.dataSource.loadEntriesForScope({
      from: input.from,
      to: input.to,
      trackerIds: input.trackerIds,
    });
    return generateSignals(
      dataset.entries,
      dataset.trackerVersions,
      { trackerIds: input.trackerIds },
      input.bucketSize,
    );
  }
}
