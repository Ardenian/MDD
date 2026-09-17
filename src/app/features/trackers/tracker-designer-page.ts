import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import type { FieldDataType, FieldDef, ReferenceCardinality } from '../../data/model/field-def';
import type { TimeMode } from '../../data/model/tracker';
import { ReorderableList } from '../../ui/components/reorderable-list/reorderable-list';
import { Select } from '../../ui/components/select/select';
import type { SelectOption } from '../../ui/components/select/select-option';
import { DraftFieldRow } from './draft-field-row';
import { draftDiffersFromVersion, findFieldProblems } from './tracker-schema';
import { TrackersDataAccess } from './trackers-data-access';

const TIME_MODES: readonly TimeMode[] = ['point', 'period', 'dayBucketed'];

/**
 * The Tracker editor: this feature's other top-level (route) component, and with the
 * list page the only place here allowed to inject a facade or a `ui/` service (ADR 0002).
 * Everything it renders beneath itself is presentation-only.
 */
@Component({
  selector: 'app-tracker-designer-page',
  imports: [TranslatePipe, RouterLink, Select, ReorderableList, DraftFieldRow],
  template: `
    <section
      class="designer"
      data-testid="tracker-designer"
      [attr.data-current-version]="view.tracker()?.currentVersion"
      [attr.data-default-time-mode]="view.tracker()?.defaultTimeMode"
    >
      <a routerLink="/trackers" data-testid="back-to-trackers">{{
        'trackers.designer.back' | translate
      }}</a>

      @if (view.tracker(); as tracker) {
        <header class="designer__header">
          <label class="designer__name">
            <span>{{ 'trackers.designer.name' | translate }}</span>
            <input
              type="text"
              data-testid="tracker-name"
              [value]="tracker.name"
              (change)="rename($event)"
            />
          </label>

          <ui-select
            data-testid="tracker-time-mode"
            [label]="'trackers.designer.defaultTimeMode' | translate"
            [options]="timeModeOptions()"
            [value]="tracker.defaultTimeMode"
            [clearable]="false"
            (valueChange)="changeTimeMode($event)"
          />

          <button type="button" data-testid="archive-toggle" (click)="toggleArchived()">
            {{
              (tracker.archived ? 'trackers.designer.unarchive' : 'trackers.designer.archive')
                | translate
            }}
          </button>
        </header>

        <p class="designer__status" data-testid="draft-status" aria-live="polite">
          @if (draftDiffers()) {
            {{ 'trackers.designer.draftDiffers' | translate: { version: tracker.currentVersion } }}
          } @else if (tracker.currentVersion > 0) {
            {{ 'trackers.designer.committed' | translate: { version: tracker.currentVersion } }}
          } @else {
            {{ 'trackers.designer.noFields' | translate }}
          }
        </p>

        <h2>{{ 'trackers.designer.draftHeading' | translate }}</h2>

        @if (draftFields().length === 0) {
          <p data-testid="no-fields">{{ 'trackers.designer.noFields' | translate }}</p>
        } @else {
          <ui-reorderable-list
            [items]="draftRows()"
            [idOf]="rowId"
            [rowTemplate]="fieldRow"
            [moveUpLabel]="'trackers.designer.moveUp' | translate"
            [moveDownLabel]="'trackers.designer.moveDown' | translate"
            (reordered)="reorder($event)"
          />
        }

        <ng-template #fieldRow let-row>
          <app-draft-field-row
            [field]="row.field"
            [trackers]="trackerOptions()"
            [dataTypeLabels]="dataTypeLabels()"
            [cardinalityLabels]="cardinalityLabels()"
            (changed)="replaceField(row.index, $event)"
            (removed)="removeField(row.index)"
          />
        </ng-template>

        <div class="designer__actions">
          <button type="button" data-testid="add-field" (click)="addField()">
            {{ 'trackers.designer.addField' | translate }}
          </button>
          <button
            type="button"
            data-testid="commit-draft"
            [disabled]="!draftDiffers() || problems().length > 0"
            (click)="commit()"
          >
            {{ 'trackers.designer.commit' | translate }}
          </button>
          <button
            type="button"
            data-testid="discard-draft"
            [disabled]="!draftDiffers()"
            (click)="discard()"
          >
            {{ 'trackers.designer.discard' | translate }}
          </button>
        </div>

        @if (problems().length > 0) {
          <ul class="designer__problems" data-testid="draft-problems" aria-live="polite">
            @for (problem of problemMessages(); track $index) {
              <li>{{ problem }}</li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: `
    .designer {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      max-width: 60rem;
    }

    .designer__header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--space-5);
    }

    .designer__name {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .designer__name input {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      font-size: var(--text-md);
    }

    .designer__status {
      margin: 0;
      color: var(--color-ink-muted);
    }

    .designer__actions {
      display: flex;
      gap: var(--space-3);
    }

    .designer__actions button {
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }

    .designer__actions button:disabled {
      color: var(--color-ink-muted);
      cursor: not-allowed;
      opacity: 0.6;
    }

    .designer__problems {
      margin: 0;
      padding-inline-start: var(--space-5);
      color: var(--color-danger);
    }
  `,
})
export class TrackerDesignerPage {
  /** Bound from the route parameter — the selection is this component's, not the facade's. */
  readonly trackerId = input.required<string>();

  private readonly access = inject(TrackersDataAccess);
  private readonly lookup = inject(TrackerLookup);
  private readonly translate = inject(TranslateService);

  protected readonly view = this.access.designerFor(computed(() => this.trackerId()));

  private readonly localDraft = signal<readonly FieldDef[] | null>(null);

  protected readonly draftFields = computed(
    () => this.localDraft() ?? this.view.tracker()?.draftFields ?? [],
  );

  protected readonly draftRows = computed(() =>
    this.draftFields().map((field, index) => ({ field, index })),
  );

  protected readonly trackerOptions = computed(() => this.lookup.list());

  protected readonly problems = computed(() => findFieldProblems(this.draftFields()));

  protected readonly draftDiffers = computed(() => {
    const tracker = this.view.tracker();
    if (tracker === undefined) {
      return false;
    }
    const committed = tracker.currentVersion === 0 ? undefined : this.view.committedFields();
    return draftDiffersFromVersion(this.draftFields(), committed);
  });

  protected readonly timeModeOptions = computed<readonly SelectOption[]>(() =>
    TIME_MODES.map((value) => ({
      value,
      label: this.translate.instant(`trackers.designer.timeMode.${value}`),
    })),
  );

  protected readonly dataTypeLabels = computed<Readonly<Record<FieldDataType, string>>>(() => ({
    text: this.translate.instant('trackers.field.type.text'),
    longText: this.translate.instant('trackers.field.type.longText'),
    integer: this.translate.instant('trackers.field.type.integer'),
    decimal: this.translate.instant('trackers.field.type.decimal'),
    boolean: this.translate.instant('trackers.field.type.boolean'),
    singleSelect: this.translate.instant('trackers.field.type.singleSelect'),
    multiSelect: this.translate.instant('trackers.field.type.multiSelect'),
    reference: this.translate.instant('trackers.field.type.reference'),
  }));

  protected readonly cardinalityLabels = computed<Readonly<Record<ReferenceCardinality, string>>>(
    () => ({
      one: this.translate.instant('trackers.field.cardinalityOne'),
      many: this.translate.instant('trackers.field.cardinalityMany'),
    }),
  );

  protected readonly problemMessages = computed(() =>
    this.problems().map((problem) =>
      this.translate.instant(`trackers.problems.${problem.kind}`, {
        ...problem,
        index: problem.index + 1,
      }),
    ),
  );

  protected readonly rowId = (row: { field: FieldDef; index: number }) => String(row.index);

  constructor() {
    // A different Tracker means a different Draft; local edits must not leak across.
    effect(() => {
      this.trackerId();
      this.localDraft.set(null);
    });
  }

  protected rename(event: Event): void {
    void this.applyMeta({ name: (event.target as HTMLInputElement).value });
  }

  protected changeTimeMode(mode: string | null): void {
    if (mode !== null) {
      void this.applyMeta({ defaultTimeMode: mode as TimeMode });
    }
  }

  protected toggleArchived(): void {
    const tracker = this.view.tracker();
    if (tracker !== undefined) {
      void this.access.setArchived(tracker.id, !tracker.archived).then(() => this.view.reload());
    }
  }

  protected addField(): void {
    void this.persistDraft([
      ...this.draftFields(),
      { name: '', required: false, dataType: 'text' },
    ]);
  }

  protected replaceField(index: number, field: FieldDef): void {
    void this.persistDraft(
      this.draftFields().map((existing, position) => (position === index ? field : existing)),
    );
  }

  protected removeField(index: number): void {
    void this.persistDraft(this.draftFields().filter((_, position) => position !== index));
  }

  protected reorder(rows: readonly { field: FieldDef; index: number }[]): void {
    void this.persistDraft(rows.map((row) => row.field));
  }

  protected commit(): void {
    const tracker = this.view.tracker();
    if (tracker !== undefined) {
      // The local Draft is deliberately kept: it already equals what was committed, and
      // clearing it here would discard any edit made while the commit was in flight.
      void this.access.commitDraft(tracker.id).then(() => this.view.reload());
    }
  }

  /** Discard reverts to the committed Version, which is what a Draft is measured against. */
  protected discard(): void {
    const tracker = this.view.tracker();
    if (tracker !== undefined) {
      void this.persistDraft(this.view.committedFields()).then(() => this.view.reload());
    }
  }

  private async persistDraft(fields: readonly FieldDef[]): Promise<void> {
    this.localDraft.set(fields);
    const tracker = this.view.tracker();
    if (tracker !== undefined) {
      await this.access.saveDraft(tracker.id, fields);
    }
  }

  private async applyMeta(change: { name?: string; defaultTimeMode?: TimeMode }): Promise<void> {
    const tracker = this.view.tracker();
    if (tracker !== undefined) {
      await this.access.updateMeta(tracker.id, change);
      this.lookup.reload();
      this.view.reload();
    }
  }
}
