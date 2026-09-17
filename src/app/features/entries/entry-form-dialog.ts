import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TrackerLookup } from '../../data/facades/tracker-lookup';
import type { FieldDef } from '../../data/model/field-def';
import type { FieldValues } from '../../data/model/field-values';
import type { Placement } from '../../data/model/placement';
import { Modal } from '../../ui/components/modal/modal';
import { NestedList } from '../../ui/components/nested-list/nested-list';
import { Select } from '../../ui/components/select/select';
import type { SelectOption } from '../../ui/components/select/select-option';
import { EntriesDataAccess, type EntryForm, type EntryFormRequest } from './entries-data-access';
import {
  addChild,
  type EntryFormNode,
  type EntryFormProblems,
  findNode,
  hasProblems,
  removeNode,
  updateNode,
  validateForm,
} from './entry-form';
import { EntryNodeEditor } from './entry-node-editor';
import { PlacementEditor } from './placement-editor';
import { movedTo, validatePlacement } from './fadeout';

export type EntryFormOutcome = 'saved' | 'deleted' | 'cancelled';

/**
 * The Entry form. `entries/SPEC.md` names this component — not the route that opens it —
 * as the place `EntriesDataAccess` is injected; everything it renders beneath itself is
 * presentation-only. The tree being edited is this component's own working state.
 */
@Component({
  selector: 'app-entry-form-dialog',
  imports: [TranslatePipe, Modal, Select, NestedList, EntryNodeEditor, PlacementEditor],
  template: `
    <ui-modal
      [title]="title()"
      [closeLabel]="'entries.form.close' | translate"
      (dismissed)="finished.emit('cancelled')"
    >
      @if (loadFailed()) {
        <p role="alert" data-testid="load-error">{{ 'entries.form.loadFailed' | translate }}</p>
      } @else if (form(); as loaded) {
        <form class="entry-form" data-testid="entry-form" novalidate (submit)="save($event)">
          <p class="entry-form__version" data-testid="version-label">
            @if (loaded.isNew) {
              {{
                'entries.form.currentVersion' | translate: { version: loaded.root.trackerVersion }
              }}
            } @else {
              {{
                'entries.form.pinnedVersion' | translate: { version: loaded.root.trackerVersion }
              }}
              @if (loaded.root.trackerVersion !== loaded.currentVersion) {
                <span class="entry-form__explanation" data-testid="version-explanation">
                  {{
                    'entries.form.pinnedExplanation'
                      | translate
                        : { version: loaded.root.trackerVersion, current: loaded.currentVersion }
                  }}
                </span>
              }
            }
          </p>

          @if (loaded.isNew && presetOptions().length > 0) {
            <ui-select
              data-testid="preset"
              [label]="'entries.form.preset' | translate"
              [options]="presetOptions()"
              [value]="presetId()"
              [clearable]="false"
              (valueChange)="applyPreset($event)"
            />
          }

          <app-placement-editor
            [(placement)]="placement"
            [problem]="placementProblem()"
            [idPrefix]="root().key"
            (nowRequested)="placement.set(moveToNow(placement()))"
          />

          <app-entry-node-editor
            data-testid="entry-root"
            [node]="root()"
            [depth]="1"
            [cap]="loaded.expansionDepthCap"
            [isRoot]="true"
            [problems]="messagesFor(root().key)"
            [tagSuggestions]="tagSuggestions()"
            (valuesChange)="setValues(root().key, $event)"
            (tagsChange)="setTags(root().key, $event)"
            (tagQuery)="tagQuery.set($event)"
            (addChild)="addChildTo(root().key, $event)"
          />

          @if (root().children.length > 0) {
            <div data-testid="children">
              <ui-nested-list
                [nodes]="root().children"
                [idOf]="keyOf"
                [childrenAccessor]="childrenOfNode"
                [nodeTemplate]="child"
                [cap]="loaded.expansionDepthCap"
                [startDepth]="2"
              />
            </div>
          }

          <ng-template #child let-node let-depth="depth">
            <app-entry-node-editor
              data-testid="entry-node"
              [node]="node"
              [depth]="depth"
              [cap]="loaded.expansionDepthCap"
              [trackerName]="trackerNames().get(node.trackerId) ?? ''"
              [problems]="messagesFor(node.key)"
              [tagSuggestions]="tagSuggestions()"
              (valuesChange)="setValues(node.key, $event)"
              (tagsChange)="setTags(node.key, $event)"
              (tagQuery)="tagQuery.set($event)"
              (addChild)="addChildTo(node.key, $event)"
              (removed)="remove(node.key)"
            />
          </ng-template>

          @if (invalidCount() > 0) {
            <p class="entry-form__summary" data-testid="form-problems" aria-live="polite">
              {{ 'entries.form.problemsSummary' | translate: { count: invalidCount() } }}
            </p>
          }
          @if (saveFailed()) {
            <p class="entry-form__summary" role="alert" data-testid="save-error">
              {{ 'entries.form.saveFailed' | translate }}
            </p>
          }
        </form>
      } @else {
        <p data-testid="loading">{{ 'entries.form.loading' | translate }}</p>
      }

      <div modal-actions class="entry-form__actions">
        @if (form()?.isNew === false) {
          <button
            type="button"
            class="entry-form__delete"
            data-testid="delete-entry"
            [disabled]="saving()"
            (click)="delete()"
          >
            {{ 'entries.form.delete' | translate }}
          </button>
        }
        <button type="button" data-testid="cancel" (click)="finished.emit('cancelled')">
          {{ 'entries.form.cancel' | translate }}
        </button>
        <button
          type="button"
          class="entry-form__save"
          data-testid="save"
          [disabled]="!canSave()"
          (click)="save()"
        >
          {{ (saving() ? 'entries.form.saving' : 'entries.form.save') | translate }}
        </button>
      </div>
    </ui-modal>
  `,
  styles: `
    .entry-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      min-width: min(34rem, calc(100vw - var(--space-8)));
    }

    .entry-form__version {
      display: flex;
      flex-direction: column;
      margin: 0;
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .entry-form__summary {
      margin: 0;
      color: var(--color-danger);
    }

    .entry-form__actions button {
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }

    .entry-form__actions .entry-form__save {
      border-color: transparent;
      background: var(--color-accent);
      color: var(--color-ink-inverted);
    }

    .entry-form__actions .entry-form__save:disabled {
      background: var(--color-border);
      color: var(--color-ink-muted);
      cursor: not-allowed;
    }

    .entry-form__actions .entry-form__delete {
      margin-inline-end: auto;
      color: var(--color-danger);
    }
  `,
})
export class EntryFormDialog {
  readonly request = input.required<EntryFormRequest>();
  readonly finished = output<EntryFormOutcome>();

  private readonly access = inject(EntriesDataAccess);
  private readonly lookup = inject(TrackerLookup);
  private readonly translate = inject(TranslateService);

  protected readonly form = signal<EntryForm | null>(null);
  protected readonly root = signal<EntryFormNode>(emptyRoot());
  protected readonly placement = signal<Placement>({
    kind: 'point',
    at: new Date(0).toISOString(),
  });
  protected readonly presetId = signal<string | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly tagQuery = signal('');

  private original: ReadonlySet<string> = new Set();

  protected readonly tagSuggestions = this.access.tagSuggestionsFor(this.tagQuery);
  private readonly presets = this.access.presetsFor(
    computed(() => (this.form()?.isNew === true ? this.root().trackerId : null)),
  );

  protected readonly trackerNames = computed(
    () => new Map(this.lookup.list().map((tracker) => [tracker.id, tracker.name])),
  );

  protected readonly title = computed(() => {
    const form = this.form();
    const tracker = form === null ? '' : (this.trackerNames().get(this.root().trackerId) ?? '');
    return this.translate.instant(
      form?.isNew === false ? 'entries.form.editTitle' : 'entries.form.newTitle',
      { tracker },
    );
  });

  protected readonly presetOptions = computed<readonly SelectOption[]>(() => {
    const current = this.form()?.currentVersion ?? 0;
    return this.presets().map((preset) => ({
      value: preset.id,
      label:
        preset.trackerVersion < current
          ? this.translate.instant('entries.form.presetStale', { name: preset.name })
          : preset.name,
    }));
  });

  private readonly problems = computed<EntryFormProblems>(() =>
    validateForm(this.root(), this.form()?.expansionDepthCap ?? 1),
  );

  protected readonly placementProblem = computed(() => {
    const problem = validatePlacement(this.placement());
    return problem === null ? null : this.translate.instant(`entries.problems.${problem}`);
  });

  protected readonly messages = computed(() => {
    const cap = this.form()?.expansionDepthCap ?? 1;
    const translated: Partial<Record<string, Record<string, string>>> = {};
    for (const [key, fields] of Object.entries(this.problems())) {
      translated[key] = Object.fromEntries(
        Object.entries(fields).map(([field, problem]) => [
          field,
          this.translate.instant(`entries.problems.${problem}`, { cap }),
        ]),
      );
    }
    return translated;
  });

  /** Nodes with no problems are absent from `messages`, so this is where that is handled. */
  protected messagesFor(key: string): Readonly<Record<string, string>> {
    return this.messages()[key] ?? {};
  }

  protected readonly invalidCount = computed(
    () =>
      Object.values(this.problems()).reduce(
        (count, fields) => count + Object.keys(fields).length,
        0,
      ) + (this.placementProblem() === null ? 0 : 1),
  );

  protected readonly canSave = computed(
    () =>
      this.form() !== null &&
      !this.saving() &&
      !hasProblems(this.problems()) &&
      this.placementProblem() === null,
  );

  protected readonly keyOf = (node: EntryFormNode) => node.key;
  protected readonly childrenOfNode = (node: EntryFormNode) => node.children;

  constructor() {
    effect(() => {
      const request = this.request();
      untracked(() => void this.load(request));
    });
  }

  protected moveToNow(placement: Placement): Placement {
    return movedTo(placement, Date.now());
  }

  protected setValues(key: string, values: FieldValues): void {
    this.root.update((root) => updateNode(root, key, (node) => ({ ...node, values })));
  }

  protected setTags(key: string, tags: readonly string[]): void {
    this.root.update((root) => updateNode(root, key, (node) => ({ ...node, tags })));
  }

  protected async addChildTo(parentKey: string, field: FieldDef): Promise<void> {
    const form = this.form();
    const parent = findNode(this.root(), parentKey);
    if (form === null || parent === undefined) {
      return;
    }
    const child = await this.access.newChild(field, parent.depth, form.expansionDepthCap);
    // Read the tree again: the user may have kept editing while the schema loaded.
    this.root.update((root) => addChild(root, parentKey, child));
  }

  /** Removing a child from the form is what deletes it, once the Entry is saved. */
  protected remove(key: string): void {
    this.root.update((root) => removeNode(root, key));
  }

  protected async applyPreset(presetId: string | null): Promise<void> {
    const form = this.form();
    if (presetId === null || form === null) {
      return;
    }
    this.presetId.set(presetId);
    this.root.set(await this.access.fromPreset(presetId, form.expansionDepthCap));
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      await this.access.save({ root: this.root(), placement: this.placement() }, this.original);
      this.finished.emit('saved');
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected async delete(): Promise<void> {
    const entryId = this.root().entryId;
    if (entryId === null) {
      return;
    }
    this.saving.set(true);
    try {
      await this.access.delete(entryId);
      this.finished.emit('deleted');
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(request: EntryFormRequest): Promise<void> {
    try {
      const form = await this.access.open(request);
      this.original = this.access.originalIds(form.root);
      this.root.set(form.root);
      this.placement.set(form.placement);
      this.presetId.set(request.presetId ?? null);
      this.form.set(form);
    } catch {
      this.loadFailed.set(true);
    }
  }
}

function emptyRoot(): EntryFormNode {
  return {
    key: 'loading',
    entryId: null,
    trackerId: '',
    trackerVersion: 0,
    fieldName: null,
    fields: [],
    values: {},
    tags: [],
    children: [],
  };
}
