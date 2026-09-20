import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import { TrackerListRows } from './tracker-list-rows';
import { TrackersDataAccess } from './trackers-data-access';

/**
 * The Trackers feature's list view — a top-level (route) component, so one of the two
 * places in this feature allowed to inject a facade (ADR 0002).
 */
@Component({
  selector: 'app-trackers-page',
  providers: [TrackersDataAccess],
  imports: [TranslatePipe, TrackerListRows],
  template: `
    <section class="trackers" data-testid="trackers-page">
      <header class="trackers__header">
        <h1 data-testid="page-title">{{ 'trackers.list.heading' | translate }}</h1>

        <form class="trackers__create" (submit)="create($event)">
          <label>
            <span class="visually-hidden">{{ 'trackers.list.namePlaceholder' | translate }}</span>
            <input
              type="text"
              data-testid="new-tracker-name"
              [value]="newName()"
              [attr.placeholder]="'trackers.list.namePlaceholder' | translate"
              (input)="newName.set($any($event.target).value)"
            />
          </label>
          <button type="submit" data-testid="create-tracker" [disabled]="newName().trim() === ''">
            {{ 'trackers.list.create' | translate }}
          </button>
        </form>
      </header>

      @if (access.active().length === 0 && access.archived().length === 0) {
        <p data-testid="trackers-empty">{{ 'trackers.list.empty' | translate }}</p>
      }

      <app-tracker-list-rows
        testId="tracker-list"
        [rows]="access.active()"
        (opened)="open($event)"
      />

      @if (access.archived().length > 0) {
        <details class="trackers__archived" data-testid="archived-section">
          <summary data-testid="archived-summary">
            {{ 'trackers.list.archivedHeading' | translate }}
          </summary>
          <app-tracker-list-rows
            testId="archived-tracker-list"
            [rows]="access.archived()"
            (opened)="open($event)"
          />
        </details>
      }
    </section>
  `,
  styles: `
    .trackers {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      max-width: 60rem;
    }

    .trackers__header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .trackers__create {
      display: flex;
      gap: var(--space-3);
    }

    .trackers__create input {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    .trackers__create button {
      padding: var(--space-2) var(--space-4);
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      background: var(--color-accent);
      color: var(--color-ink-inverted);
      cursor: pointer;
    }

    .trackers__create button:disabled {
      background: var(--color-border);
      color: var(--color-ink-muted);
      cursor: not-allowed;
    }
  `,
})
export class TrackersPage {
  protected readonly access = inject(TrackersDataAccess);
  private readonly lookup = inject(TrackerLookup);
  private readonly router = inject(Router);

  protected readonly newName = signal('');

  protected create(event: Event): void {
    event.preventDefault();
    const name = this.newName().trim();
    if (name === '') {
      return;
    }
    // A new Tracker starts at Version 0 with an empty Draft: Fields are authored in the
    // designer and only become a Version when the user commits (ADR 0005).
    void this.access.createTracker({ name, defaultTimeMode: 'point' }).then((tracker) => {
      this.newName.set('');
      this.lookup.reload();
      void this.router.navigate(['/trackers', tracker.id]);
    });
  }

  protected open(id: string): void {
    void this.router.navigate(['/trackers', id]);
  }
}
