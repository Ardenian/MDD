import { DOCUMENT } from '@angular/common';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import {
  DEFAULT_SETTINGS,
  type BucketSize,
  type Guardrails,
  type LagRange,
} from '../../data/model/settings';
import { CORRELATION_DATA_SOURCE, type DateRange } from '../../data/ports/correlation-data-source';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { type BucketAxis, createBucketAxis } from './bucketing';
import {
  CORRELATION_PREFERENCES_KEY,
  type CorrelationPreferences,
  DEFAULT_CORRELATION_PREFERENCES,
  forKnownTrackers,
  parseCorrelationPreferences,
  serializeCorrelationPreferences,
  togglePinned,
  toggleSeriesVisible,
} from './correlation-preferences';
import { type PairResult, runDiscoveryAsync } from './discovery';
import { extractSeries, type Series } from './series-extraction';

export type ScanStatus = 'idle' | 'loading' | 'scanning' | 'ready' | 'failed';

export interface ScanProgress {
  readonly completed: number;
  readonly total: number;
}

interface CorrelationState {
  readonly range: DateRange;
  readonly bucketSize: BucketSize;
  /** Empty means every Tracker is in scope. */
  readonly scopeTrackerIds: readonly string[];
  readonly lagRange: LagRange;
  readonly guardrails: Guardrails;
  readonly showAll: boolean;
  readonly status: ScanStatus;
  readonly progress: ScanProgress;
  readonly cancelled: boolean;
  readonly series: readonly Series[];
  readonly axisBoundaries: readonly number[];
  readonly results: readonly PairResult[];
  readonly selectedPairId: string | null;
  /** The lag the Directed view is showing, which the user can move off the best one. */
  readonly selectedLag: number | null;
  readonly preferences: CorrelationPreferences;
  /**
   * Bumped once the saved defaults have been read. The controls seed themselves from it,
   * so arriving defaults can never overwrite something the user has already typed.
   */
  readonly defaultsVersion: number;
  /** Completed scan runs. Monotone, so a test can wait for *this* scan to finish. */
  readonly scanCount: number;
  /** An overlay load is not a scan: it has no pairs, no progress and nothing to cancel. */
  readonly overlayLoading: boolean;
}

const DEFAULT_RANGE_DAYS = 90;

function defaultRange(): DateRange {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - DEFAULT_RANGE_DAYS);
  return { start: start.toISOString(), end: end.toISOString() };
}

const initialState: CorrelationState = {
  range: { start: '', end: '' },
  bucketSize: DEFAULT_SETTINGS.defaultBucketSize,
  scopeTrackerIds: [],
  lagRange: DEFAULT_SETTINGS.defaultLagRange,
  guardrails: DEFAULT_SETTINGS.guardrails,
  showAll: false,
  status: 'idle',
  progress: { completed: 0, total: 0 },
  cancelled: false,
  series: [],
  axisBoundaries: [],
  results: [],
  selectedPairId: null,
  selectedLag: null,
  preferences: DEFAULT_CORRELATION_PREFERENCES,
  defaultsVersion: 0,
  scanCount: 0,
  overlayLoading: false,
};

/**
 * The one stateful facade in the app (ADR 0008): a Discovery scan accumulates progress,
 * a cancellation flag, a result list and the user's pinned pairs — state that outlives
 * any single async call, which is exactly what a `DataAccess` is not for.
 */
export const CorrelationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    isScanning: computed(() => store.status() === 'scanning' || store.status() === 'loading'),
    /** Buckets are only meaningful once a scan has produced an axis to hang them on. */
    axis: computed<BucketAxis | null>(() =>
      store.axisBoundaries().length < 2
        ? null
        : {
            size: store.bucketSize(),
            boundaries: store.axisBoundaries(),
            count: store.axisBoundaries().length - 1,
          },
    ),
    selectedPair: computed<PairResult | null>(
      () => store.results().find((result) => result.id === store.selectedPairId()) ?? null,
    ),
    pinnedPairs: computed(() =>
      store.results().filter((result) => store.preferences().pinnedPairIds.includes(result.id)),
    ),
    /** The Series the overlay draws: the chosen Trackers', minus the ones switched off. */
    overlaySeries: computed(() => {
      const { overlayTrackerIds, hiddenSeriesIds } = store.preferences();
      return store
        .series()
        .filter(
          (series) =>
            overlayTrackerIds.includes(series.trackerId) && !hiddenSeriesIds.includes(series.id),
        );
    }),
    overlayCandidates: computed(() =>
      store
        .series()
        .filter((series) => store.preferences().overlayTrackerIds.includes(series.trackerId)),
    ),
  })),

  withMethods((store) => {
    const source = inject(CORRELATION_DATA_SOURCE);
    const settings = inject(SETTINGS_REPOSITORY);
    // Reached through the document, as the Calendar does: there is no global `window`
    // wherever this runs without one.
    const storage = inject(DOCUMENT).defaultView?.localStorage;
    /** Read at the top of each scan loop; a plain field, since it must not be reactive. */
    let cancelRequested = false;

    const persist = (preferences: CorrelationPreferences): void => {
      patchState(store, { preferences });
      try {
        storage?.setItem(CORRELATION_PREFERENCES_KEY, serializeCorrelationPreferences(preferences));
      } catch {
        // A device that refuses storage still gets a working page for this session.
      }
    };

    return {
      /** Settings own the defaults; this page only starts from them (settings/SPEC.md). */
      async loadDefaults(): Promise<void> {
        let stored: string | null = null;
        try {
          stored = storage?.getItem(CORRELATION_PREFERENCES_KEY) ?? null;
        } catch {
          stored = null;
        }
        const saved = await settings.get();
        patchState(store, {
          range: defaultRange(),
          bucketSize: saved.defaultBucketSize,
          lagRange: saved.defaultLagRange,
          guardrails: saved.guardrails,
          preferences: parseCorrelationPreferences(stored),
          defaultsVersion: store.defaultsVersion() + 1,
        });
      },

      setRange(range: DateRange): void {
        patchState(store, { range });
      },

      setBucketSize(bucketSize: BucketSize): void {
        patchState(store, { bucketSize });
      },

      setLagRange(lagRange: LagRange): void {
        patchState(store, { lagRange });
      },

      setGuardrails(guardrails: Guardrails): void {
        patchState(store, { guardrails });
      },

      setShowAll(showAll: boolean): void {
        patchState(store, { showAll });
      },

      toggleScopeTracker(trackerId: string): void {
        const current = store.scopeTrackerIds();
        patchState(store, {
          scopeTrackerIds: current.includes(trackerId)
            ? current.filter((id) => id !== trackerId)
            : [...current, trackerId],
        });
      },

      clearScope(): void {
        patchState(store, { scopeTrackerIds: [] });
      },

      async scan(): Promise<void> {
        cancelRequested = false;
        patchState(store, {
          status: 'loading',
          cancelled: false,
          progress: { completed: 0, total: 0 },
          results: [],
          selectedPairId: null,
        });

        try {
          const range = store.range();
          const dataset = await source.loadEntriesForScope(range, {
            trackerIds: store.scopeTrackerIds(),
          });
          const axis = createBucketAxis(
            { start: Date.parse(range.start), end: Date.parse(range.end) },
            store.bucketSize(),
          );
          const series = extractSeries(dataset, axis);
          patchState(store, {
            status: 'scanning',
            series,
            axisBoundaries: axis.boundaries,
            preferences: forKnownTrackers(
              store.preferences(),
              new Set(dataset.trackers.map((tracker) => tracker.id)),
            ),
          });

          const outcome = await runDiscoveryAsync(
            series,
            {
              lagRange: store.lagRange(),
              guardrails: store.guardrails(),
              showAll: store.showAll(),
            },
            {
              onProgress: (completed, total) =>
                patchState(store, { progress: { completed, total } }),
              isCancelled: () => cancelRequested,
            },
          );
          patchState(store, {
            status: 'ready',
            results: outcome.results,
            cancelled: outcome.cancelled,
            scanCount: store.scanCount() + 1,
          });
        } catch {
          // The global ErrorHandler has already told the user; the page just stops.
          patchState(store, { status: 'failed', scanCount: store.scanCount() + 1 });
        }
      },

      cancel(): void {
        cancelRequested = true;
      },

      selectPair(pairId: string | null): void {
        const pair = store.results().find((result) => result.id === pairId) ?? null;
        patchState(store, { selectedPairId: pairId, selectedLag: pair?.lag ?? null });
      },

      setSelectedLag(lag: number): void {
        patchState(store, { selectedLag: lag });
      },

      togglePin(pairId: string): void {
        persist(togglePinned(store.preferences(), pairId));
      },

      setOverlayTrackers(trackerIds: readonly string[]): void {
        persist({ ...store.preferences(), overlayTrackerIds: trackerIds });
      },

      toggleOverlaySeries(seriesId: string): void {
        persist(toggleSeriesVisible(store.preferences(), seriesId));
      },

      /**
       * The overlay plots Series without correlating anything, so it needs the extraction
       * step but never the scan (correlation/SPEC.md).
       */
      async loadSeriesForOverlay(): Promise<void> {
        patchState(store, { overlayLoading: true });
        try {
          const range = store.range();
          const dataset = await source.loadEntriesForScope(range, {
            trackerIds: store.preferences().overlayTrackerIds,
          });
          const axis = createBucketAxis(
            { start: Date.parse(range.start), end: Date.parse(range.end) },
            store.bucketSize(),
          );
          patchState(store, {
            overlayLoading: false,
            series: extractSeries(dataset, axis),
            axisBoundaries: axis.boundaries,
          });
        } catch {
          patchState(store, { overlayLoading: false });
        }
      },
    };
  }),
);
