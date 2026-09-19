import { computed, inject, resource, Service } from '@angular/core';
import { TRACKER_REPOSITORY } from '../ports/tracker-repository';

/** A name and archived state per Tracker — nothing about its Fields. */
export interface TrackerSummary {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  /**
   * Whether anything can be logged against it yet. A Tracker with no committed Version
   * has no schema to snapshot, so a picker that starts an Entry must not offer it.
   */
  readonly hasVersion: boolean;
}

/**
 * The shared DataAccess behind every Tracker picker in the app (Trackers' own list,
 * Calendar's toggle panel, Correlation's scope picker). Lives in `data/` rather than any
 * one feature because none of those three owns it (ADR 0002, ADR 0008).
 */
@Service()
export class TrackerLookup {
  private readonly trackers = inject(TRACKER_REPOSITORY);

  private readonly all = resource({
    loader: () => this.trackers.list(),
    defaultValue: [],
  });

  readonly list = computed<readonly TrackerSummary[]>(() =>
    this.all.value().map(({ id, name, archived, currentVersion }) => ({
      id,
      name,
      archived,
      hasVersion: currentVersion > 0,
    })),
  );

  /**
   * Names by id, for anywhere a Tracker is referred to by id alone — a reference Field's
   * target, a child Entry's parent. Derived here rather than rebuilt per feature.
   */
  readonly nameById = computed(
    () => new Map(this.list().map((tracker) => [tracker.id, tracker.name])),
  );

  readonly isLoading = computed(() => this.all.isLoading());

  /** Trackers are metadata, not versioned — a rename must show up immediately. */
  reload(): void {
    this.all.reload();
  }
}
