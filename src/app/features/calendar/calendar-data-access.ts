import { computed, inject, Injector, resource, Service, type Signal } from '@angular/core';
import type { Entry } from '../../data/model/entry';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';

export interface CalendarQuery {
  readonly start: string;
  readonly end: string;
  readonly includeChildren: boolean;
}

export interface CalendarEntriesView {
  readonly entries: Signal<readonly Entry[]>;
  readonly isLoading: Signal<boolean>;
  reload(): void;
}

/**
 * Stateless DataAccess (ADR 0008) over the Calendar's only read. The visible range and
 * the child filter are the page's state; they come in as a signal, so this holds none.
 */
@Service()
export class CalendarDataAccess {
  private readonly entries = inject(ENTRY_REPOSITORY);
  private readonly injector = inject(Injector);

  /** Call from an injection context. */
  entriesFor(query: Signal<CalendarQuery>): CalendarEntriesView {
    const read = resource({
      injector: this.injector,
      params: () => query(),
      loader: ({ params }) =>
        this.entries.listByRange(params.start, params.end, {
          includeChildren: params.includeChildren,
        }),
      defaultValue: [],
    });
    return {
      entries: computed(() => read.value()),
      isLoading: computed(() => read.isLoading()),
      reload: () => read.reload(),
    };
  }
}
