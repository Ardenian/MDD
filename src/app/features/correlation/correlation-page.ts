import { Component, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import { localDayOf } from '../../data/model/placement';
import type { BucketSize } from '../../data/model/settings';
import { CorrelationControls, type ScanSettings } from './correlation-controls';
import { CorrelationStore } from './correlation-store';
import { DirectedView } from './directed-view';
import { DEFAULT_RESULT_SORT, type ResultSort } from './results-sort';
import { ResultsTable } from './results-table';
import type { SeriesWords } from './series-naming';
import { SeriesOverlay } from './series-overlay';

const BUCKET_SIZES: readonly BucketSize[] = ['hour', 'day', 'week', 'month'];

/**
 * The Correlation feature's top-level component — per ADR 0002 the only place here
 * allowed to inject a facade or a `ui/` service. It injects two: this feature's
 * `CorrelationStore` and `data/`'s shared `TrackerLookup` for the scope picker.
 */
@Component({
  selector: 'app-correlation-page',
  imports: [TranslatePipe, CorrelationControls, ResultsTable, DirectedView, SeriesOverlay],
  template: `
    <!--
      data-scan-count counts finished scans, so a test can wait for the scan it just
      started rather than for a progress line that may not have appeared yet.
    -->
    <section
      class="correlation"
      data-testid="correlation-page"
      [attr.data-scan-count]="store.scanCount()"
    >
      <h1 data-testid="page-title">{{ 'app.nav.correlation' | translate }}</h1>
      <p class="correlation__caveat" data-testid="caveat">{{ 'correlation.caveat' | translate }}</p>

      <!--
        Held back until the saved defaults are in: controls filled with placeholder values
        that are about to be replaced would throw away anything typed in the meantime.
      -->
      @if (store.defaultsVersion() > 0) {
        <app-correlation-controls
          [(settings)]="settings"
          [trackers]="lookup.list()"
          [scopeTrackerIds]="store.scopeTrackerIds()"
          [scanning]="store.isScanning()"
          [bucketLabels]="bucketLabels()"
          (scopeToggled)="store.toggleScopeTracker($event)"
          (scanRequested)="scan()"
          (cancelled)="store.cancel()"
        />
      }

      @if (store.isScanning()) {
        <p class="correlation__progress" data-testid="scan-progress" aria-live="polite">
          {{
            'correlation.progress'
              | translate: { completed: store.progress().completed, total: store.progress().total }
          }}
        </p>
      }

      @if (store.status() === 'ready') {
        @if (store.cancelled()) {
          <p data-testid="scan-cancelled">{{ 'correlation.cancelled' | translate }}</p>
        }

        @if (store.results().length === 0) {
          <p data-testid="results-empty">{{ 'correlation.empty' | translate }}</p>
        } @else {
          <app-results-table
            [results]="store.results()"
            [pinnedIds]="store.preferences().pinnedPairIds"
            [currentSort]="sort()"
            (sort)="sort.set($event)"
            (opened)="store.selectPair($event)"
            (pinned)="store.togglePin($event)"
          />
        }
      }

      @if (store.selectedPair(); as pair) {
        <app-directed-view
          [pair]="pair"
          [seriesWords]="seriesWords()"
          [lag]="store.selectedLag() ?? pair.lag"
          [lagMin]="store.lagRange().min"
          [lagMax]="store.lagRange().max"
          [pinned]="store.preferences().pinnedPairIds.includes(pair.id)"
          (lagChanged)="store.setSelectedLag($event)"
          (pinToggled)="store.togglePin($event)"
          (closed)="store.selectPair(null)"
        />
      }

      <app-series-overlay
        [trackers]="lookup.list()"
        [seriesWords]="seriesWords()"
        [selectedTrackerIds]="store.preferences().overlayTrackerIds"
        [candidates]="store.overlayCandidates()"
        [hiddenSeriesIds]="store.preferences().hiddenSeriesIds"
        (trackersChanged)="chooseOverlayTrackers($event)"
        (seriesToggled)="store.toggleOverlaySeries($event)"
      />
    </section>
  `,
  styles: `
    .correlation {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .correlation__caveat {
      margin: 0;
      color: var(--color-ink-muted);
    }

    .correlation__progress {
      margin: 0;
      font-weight: var(--weight-medium);
    }
  `,
})
export class CorrelationPage {
  protected readonly store = inject(CorrelationStore);
  protected readonly lookup = inject(TrackerLookup);
  private readonly translate = inject(TranslateService);

  protected readonly sort = signal<ResultSort>(DEFAULT_RESULT_SORT);

  /**
   * The controls edit a flat, form-shaped copy; the Store keeps the authoritative values
   * and only hears about them when a scan starts, so half-typed numbers never disturb a
   * result list that is already on screen.
   *
   * Seeded from the saved defaults and only re-seeded when those are loaded again — not
   * whenever the Store changes, which would silently undo the edit that caused it.
   */
  protected readonly settings = linkedSignal<number, ScanSettings>({
    source: () => this.store.defaultsVersion(),
    // Read untracked: the load is the only thing that may re-seed the form, never the
    // Store values the form itself writes.
    computation: () =>
      untracked(() => ({
        start: asLocalDay(this.store.range().start),
        end: asLocalDay(this.store.range().end),
        bucketSize: this.store.bucketSize(),
        lagRange: this.store.lagRange(),
        guardrails: this.store.guardrails(),
        showAll: this.store.showAll(),
      })),
  });

  /** Translated once here, because a chart legend needs a plain string, not a pipe. */
  protected readonly seriesWords = computed<SeriesWords>(() => ({
    average: this.translate.instant('correlation.series.average'),
    sum: this.translate.instant('correlation.series.sum'),
    entryDuration: this.translate.instant('correlation.series.entryDuration'),
  }));

  protected readonly bucketLabels = computed<Readonly<Record<BucketSize, string>>>(
    () =>
      Object.fromEntries(
        // This feature's own keys: the Settings feature's translations are not loaded on
        // this route, so borrowing its keys would print them raw.
        BUCKET_SIZES.map((size) => [
          size,
          this.translate.instant(`correlation.controls.bucket.${size}`),
        ]),
      ) as Record<BucketSize, string>,
  );

  constructor() {
    // The page opens on the user's saved defaults, which Settings owns (settings/SPEC.md).
    void this.store.loadDefaults();
    this.lookup.reload();
  }

  protected scan(): void {
    this.applySettings();
    void this.store.scan();
  }

  protected chooseOverlayTrackers(trackerIds: readonly string[]): void {
    this.store.setOverlayTrackers(trackerIds);
    this.applySettings();
    void this.store.loadSeriesForOverlay();
  }

  private applySettings(): void {
    const settings = this.settings();
    this.store.setRange({
      start: startOfLocalDay(settings.start),
      end: endOfLocalDay(settings.end),
    });
    this.store.setBucketSize(settings.bucketSize);
    this.store.setLagRange(settings.lagRange);
    this.store.setGuardrails(settings.guardrails);
    this.store.setShowAll(settings.showAll);
  }
}

/** The range is empty until the saved defaults arrive; a date control shows that as blank. */
function asLocalDay(instant: string): string {
  const parsed = Date.parse(instant);
  return Number.isNaN(parsed) ? '' : localDayOf(parsed);
}

/** A date control names a local day; a scan range needs the instants that day spans. */
function startOfLocalDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1).toISOString();
}

function endOfLocalDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, (date ?? 1) + 1, 0, 0, 0, -1).toISOString();
}
