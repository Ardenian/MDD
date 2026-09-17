import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import type { FieldDataType, FieldDef, ReferenceCardinality } from '../../data/model/field-def';
import { addChild, problemCount, type ValueTreeProblems } from '../../data/model/value-tree';
import type { ValueNodeLabels } from '../../ui/components/value-node-editor/value-node-editor';
import type { TimeMode } from '../../data/model/tracker';
import { ReorderableList } from '../../ui/components/reorderable-list/reorderable-list';
import { Select } from '../../ui/components/select/select';
import type { SelectOption } from '../../ui/components/select/select-option';
import { DraftFieldRow } from './draft-field-row';
import { type PresetChildRequest, PresetEditor } from './preset-editor';
import type { PresetFormNode } from './preset-form';
import { validatePreset } from './preset-form';
import { PresetList, type PresetRow } from './preset-list';
import { draftDiffersFromVersion, findFieldProblems, isPresetStale } from './tracker-schema';
import { type PresetDraft, TrackersDataAccess } from './trackers-data-access';

const TIME_MODES: readonly TimeMode[] = ['point', 'period', 'dayBucketed'];

/**
 * The Tracker editor: this feature's other top-level (route) component, and with the
 * list page the only place here allowed to inject a facade or a `ui/` service (ADR 0002).
 * Everything it renders beneath itself is presentation-only.
 */
@Component({
  selector: 'app-tracker-designer-page',
  imports: [
    TranslatePipe,
    RouterLink,
    Select,
    ReorderableList,
    DraftFieldRow,
    PresetList,
    PresetEditor,
  ],
  template: `
    <section
      class="designer"
      data-testid="tracker-designer"
      [attr.data-current-version]="view.tracker()?.currentVersion"
      [attr.data-default-time-mode]="view.tracker()?.defaultTimeMode"
      [attr.data-archived]="view.tracker()?.archived"
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

        <section class="designer__presets" data-testid="presets" aria-labelledby="presets-heading">
          <div class="designer__presets-header">
            <h2 id="presets-heading">{{ 'trackers.presets.heading' | translate }}</h2>
            @if (tracker.currentVersion > 0 && presetDraft() === null) {
              <button type="button" data-testid="new-preset" (click)="openPreset(null)">
                {{ 'trackers.presets.create' | translate }}
              </button>
            }
          </div>

          @if (tracker.currentVersion === 0) {
            <p data-testid="presets-unavailable">{{ 'trackers.presets.noVersion' | translate }}</p>
          } @else {
            <app-preset-list
              [rows]="presetRows()"
              [currentVersion]="tracker.currentVersion"
              (edited)="openPreset($event)"
              (deleted)="deletePreset($event)"
            />
          }

          @if (presetDraft(); as draft) {
            <app-preset-editor
              [(root)]="presetRoot"
              [(name)]="presetName"
              [cap]="draft.expansionDepthCap"
              [labels]="presetLabels()"
              [trackerNames]="trackerNames()"
              [messages]="presetMessages()"
              [nameMissing]="presetProblems().nameMissing"
              [problemCount]="presetProblemCount()"
              [isNew]="draft.presetId === null"
              [saving]="presetSaving()"
              (childRequested)="addPresetChild($event)"
              (saved)="savePreset()"
              (cancelled)="closePreset()"
            />
          }
        </section>
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

    .designer__presets {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding-top: var(--space-5);
      border-top: 1px solid var(--color-border);
    }

    .designer__presets-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .designer__presets-header h2 {
      margin: 0;
    }

    .designer__presets-header button {
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
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

  protected readonly presetDraft = signal<PresetDraft | null>(null);
  protected readonly presetRoot = signal<PresetFormNode>(EMPTY_PRESET_ROOT);
  protected readonly presetName = signal('');
  protected readonly presetSaving = signal(false);

  protected readonly presetRows = computed<readonly PresetRow[]>(() => {
    const current = this.view.tracker()?.currentVersion ?? 0;
    return this.view.presets().map((preset) => ({
      id: preset.id,
      name: preset.name,
      trackerVersion: preset.trackerVersion,
      stale: isPresetStale(preset.trackerVersion, current),
    }));
  });

  protected readonly trackerNames = computed(
    () => new Map(this.lookup.list().map((tracker) => [tracker.id, tracker.name])),
  );

  protected readonly presetProblems = computed(() =>
    validatePreset(
      this.presetName(),
      this.presetRoot(),
      this.presetDraft()?.expansionDepthCap ?? 1,
    ),
  );

  protected readonly presetProblemCount = computed(() => problemCount(this.presetProblems().tree));

  protected readonly presetMessages = computed(() =>
    translateProblems(
      this.presetProblems().tree,
      this.translate,
      this.presetDraft()?.expansionDepthCap ?? 1,
    ),
  );

  protected readonly presetLabels = computed<ValueNodeLabels>(() => ({
    required: this.translate.instant('valueTree.required'),
    clear: this.translate.instant('valueTree.clear'),
    remove: this.translate.instant('valueTree.node.remove'),
    childOf: (field, tracker) =>
      this.translate.instant('valueTree.node.childOf', { field, tracker }),
    level: (depth, cap) => this.translate.instant('valueTree.node.level', { depth, cap }),
    version: (version) => this.translate.instant('valueTree.version', { version }),
    addTo: (field) => this.translate.instant('valueTree.node.add', { field }),
    capReached: (cap) => this.translate.instant('valueTree.node.capReached', { cap }),
  }));

  constructor() {
    // A different Tracker means a different Draft; local edits must not leak across.
    effect(() => {
      this.trackerId();
      this.localDraft.set(null);
      this.presetDraft.set(null);
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
      void this.access.setArchived(tracker.id, !tracker.archived).then(() => {
        this.view.reload();
        // Archived Trackers leave every picker, which all read the shared lookup.
        this.lookup.reload();
      });
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
      void this.access.commitDraft(tracker.id).then(() => {
        this.view.reload();
        // The shared lookup says whether a Tracker can be logged against; a first commit changes that.
        this.lookup.reload();
      });
    }
  }

  /** Discard reverts to the committed Version, which is what a Draft is measured against. */
  protected discard(): void {
    const tracker = this.view.tracker();
    if (tracker !== undefined) {
      void this.persistDraft(this.view.committedFields()).then(() => this.view.reload());
    }
  }

  /** Opens the editor for a new Preset (`null`) or a saved one, always at the current Version. */
  protected async openPreset(presetId: string | null): Promise<void> {
    const tracker = this.view.tracker();
    if (tracker === undefined) {
      return;
    }
    const draft = await this.access.openPreset(tracker.id, presetId);
    this.presetRoot.set(draft.root);
    this.presetName.set(draft.name);
    this.presetDraft.set(draft);
  }

  protected async addPresetChild(request: PresetChildRequest): Promise<void> {
    const draft = this.presetDraft();
    if (draft === null) {
      return;
    }
    const child = await this.access.newPresetChild(
      request.field,
      request.parentDepth,
      draft.expansionDepthCap,
    );
    this.presetRoot.update((root) => addChild(root, request.parentKey, child));
  }

  /** Saving is what re-pins a stale Preset to the current Version (ADR 0005). */
  protected async savePreset(): Promise<void> {
    const draft = this.presetDraft();
    if (draft === null) {
      return;
    }
    this.presetSaving.set(true);
    try {
      await this.access.savePresetDraft({
        ...draft,
        name: this.presetName(),
        root: this.presetRoot(),
      });
      this.closePreset();
      this.view.reload();
    } finally {
      this.presetSaving.set(false);
    }
  }

  protected closePreset(): void {
    this.presetDraft.set(null);
  }

  protected async deletePreset(presetId: string): Promise<void> {
    await this.access.deletePreset(presetId);
    if (this.presetDraft()?.presetId === presetId) {
      this.closePreset();
    }
    this.view.reload();
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

const EMPTY_PRESET_ROOT: PresetFormNode = {
  key: 'none',
  trackerId: '',
  trackerVersion: 0,
  fieldName: null,
  fields: [],
  values: {},
  children: [],
};

function translateProblems(
  problems: ValueTreeProblems,
  translate: TranslateService,
  cap: number,
): Partial<Record<string, Record<string, string>>> {
  const messages: Partial<Record<string, Record<string, string>>> = {};
  for (const [key, fields] of Object.entries(problems)) {
    messages[key] = Object.fromEntries(
      Object.entries(fields ?? {}).map(([field, problem]) => [
        field,
        translate.instant(`valueTree.problems.${problem}`, { cap }),
      ]),
    );
  }
  return messages;
}
