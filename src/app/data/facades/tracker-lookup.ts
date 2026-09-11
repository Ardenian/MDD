import { Injectable, InjectionToken, inject } from '@angular/core';
import { TRACKER_REPOSITORY } from '../ports/tracker-repository';

export interface TrackerSummary {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
}

/**
 * Shared facade (ADR 0002): the name + archived-state shape every consumer of the
 * Tracker list actually needs, with nothing about Fields or Versions. Consumed by
 * Trackers' own list view, Calendar's per-Tracker toggle panel, and Correlation's
 * Signal-scope picker.
 */
export interface TrackerLookup {
  list(): Promise<readonly TrackerSummary[]>;
}

export const TRACKER_LOOKUP = new InjectionToken<TrackerLookup>('TrackerLookup');

@Injectable()
export class TrackerLookupFacade implements TrackerLookup {
  private readonly trackerRepository = inject(TRACKER_REPOSITORY);

  async list(): Promise<readonly TrackerSummary[]> {
    const trackers = await this.trackerRepository.list();
    return trackers.map(({ id, name, archived }) => ({ id, name, archived }));
  }
}
