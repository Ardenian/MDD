import { Component, input, model, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ReferenceFieldDef } from '../../data/model/field-def';
import type { FieldValues } from '../../data/model/field-values';
import { findNode, removeNode, updateNode } from '../../data/model/value-tree';
import { NestedList } from '../../ui/components/nested-list/nested-list';
import {
  ValueNodeEditor,
  type ValueNodeLabels,
} from '../../ui/components/value-node-editor/value-node-editor';
import type { PresetFormNode } from './preset-form';

export interface PresetChildRequest {
  readonly parentKey: string;
  readonly field: ReferenceFieldDef;
  readonly parentDepth: number;
}

/**
 * The Preset editor: a name plus the same value-tree editor the Entry form renders, in
 * "no placement" mode (trackers/SPEC.md). Presentation-only — it edits its two-way bound
 * tree with pure operations and asks its page for anything that needs loading, which is
 * only a new child's schema.
 */
@Component({
  selector: 'app-preset-editor',
  imports: [TranslatePipe, ValueNodeEditor, NestedList],
  template: `
    <form class="preset-editor" data-testid="preset-editor" novalidate (submit)="submit($event)">
      <h3 class="preset-editor__title">
        {{ (isNew() ? 'trackers.presets.editorNew' : 'trackers.presets.editorEdit') | translate }}
      </h3>

      <label class="preset-editor__name">
        <span>{{ 'trackers.presets.name' | translate }}</span>
        <input
          type="text"
          data-testid="preset-name-input"
          [value]="name()"
          [attr.aria-invalid]="nameMissing() ? true : null"
          [attr.aria-describedby]="nameMissing() ? root().key + '-name-error' : null"
          (input)="name.set($any($event.target).value)"
        />
      </label>
      @if (nameMissing()) {
        <p class="preset-editor__error" data-testid="name-error" [id]="root().key + '-name-error'">
          {{ 'trackers.presets.nameRequired' | translate }}
        </p>
      }

      <ui-value-node-editor
        data-testid="preset-root"
        [node]="root()"
        [depth]="1"
        [cap]="cap()"
        [isRoot]="true"
        [labels]="labels()"
        [problems]="messages()[root().key] ?? {}"
        (valuesChange)="setValues(root().key, $event)"
        (addChild)="requestChild(root().key, $event)"
      />

      @if (root().children.length > 0) {
        <div data-testid="children">
          <ui-nested-list
            [nodes]="root().children"
            [idOf]="keyOf"
            [childrenAccessor]="childrenOfNode"
            [nodeTemplate]="child"
            [cap]="cap()"
            [startDepth]="2"
          />
        </div>
      }

      <ng-template #child let-node let-depth="depth">
        <ui-value-node-editor
          data-testid="preset-node"
          [node]="node"
          [depth]="depth"
          [cap]="cap()"
          [labels]="labels()"
          [trackerName]="trackerNames().get(node.trackerId) ?? ''"
          [problems]="messages()[node.key] ?? {}"
          (valuesChange)="setValues(node.key, $event)"
          (addChild)="requestChild(node.key, $event)"
          (removed)="remove(node.key)"
        />
      </ng-template>

      @if (problemCount() > 0) {
        <p class="preset-editor__error" data-testid="preset-problems" aria-live="polite">
          {{ 'trackers.presets.problemsSummary' | translate: { count: problemCount() } }}
        </p>
      }

      <div class="preset-editor__actions">
        <button type="button" data-testid="cancel-preset" (click)="cancelled.emit()">
          {{ 'trackers.presets.cancel' | translate }}
        </button>
        <button
          type="submit"
          class="preset-editor__save"
          data-testid="save-preset"
          [disabled]="!canSave()"
        >
          {{ (saving() ? 'trackers.presets.saving' : 'trackers.presets.save') | translate }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .preset-editor {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-lg);
      background: var(--color-surface-raised);
    }

    .preset-editor__title {
      margin: 0;
      font-size: var(--text-md);
    }

    .preset-editor__name {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .preset-editor__name input {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
    }

    .preset-editor__error {
      margin: 0;
      color: var(--color-danger);
      font-size: var(--text-sm);
    }

    .preset-editor__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .preset-editor__actions button {
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }

    .preset-editor__actions .preset-editor__save {
      border-color: transparent;
      background: var(--color-accent);
      color: var(--color-ink-inverted);
    }

    .preset-editor__actions .preset-editor__save:disabled {
      background: var(--color-border);
      color: var(--color-ink-muted);
      cursor: not-allowed;
    }
  `,
})
export class PresetEditor {
  readonly root = model.required<PresetFormNode>();
  readonly name = model.required<string>();
  readonly cap = input.required<number>();
  readonly labels = input.required<ValueNodeLabels>();
  readonly trackerNames = input.required<ReadonlyMap<string, string>>();
  /** Already-translated messages, keyed by node key and then Field name. */
  readonly messages =
    input.required<Readonly<Partial<Record<string, Readonly<Record<string, string>>>>>>();
  readonly nameMissing = input.required<boolean>();
  readonly problemCount = input.required<number>();
  readonly isNew = input.required<boolean>();
  readonly saving = input(false);

  readonly childRequested = output<PresetChildRequest>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly keyOf = (node: PresetFormNode) => node.key;
  protected readonly childrenOfNode = (node: PresetFormNode) => node.children;

  protected canSave(): boolean {
    return !this.saving() && !this.nameMissing() && this.problemCount() === 0;
  }

  protected setValues(key: string, values: FieldValues): void {
    this.root.update((root) => updateNode(root, key, (node) => ({ ...node, values })));
  }

  protected remove(key: string): void {
    this.root.update((root) => removeNode(root, key));
  }

  protected requestChild(parentKey: string, field: ReferenceFieldDef): void {
    const parent = findNode(this.root(), parentKey);
    if (parent !== undefined) {
      this.childRequested.emit({ parentKey, field, parentDepth: parent.depth });
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.canSave()) {
      this.saved.emit();
    }
  }
}
