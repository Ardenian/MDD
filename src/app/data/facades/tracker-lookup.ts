import { computed, inject, resource, Service } from '@angular/core';
import { TRACKER_REPOSITORY } from '../ports/tracker-repository';

/** A name and archived state per Tracker — nothing about Fields or Versions. */
export interface TrackerSummary {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
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
    this.all.value().map(({ id, name, archived }) => ({ id, name, archived })),
  );

  readonly isLoading = computed(() => this.all.isLoading());

  /** Trackers are metadata, not versioned — a rename must show up immediately. */
  reload(): void {
    this.all.reload();
  }
}
