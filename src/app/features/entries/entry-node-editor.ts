import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { FieldDef, ReferenceFieldDef } from '../../data/model/field-def';
import type { FieldValues } from '../../data/model/field-values';
import { Combobox } from '../../ui/components/combobox/combobox';
import { SchemaFields } from '../../ui/components/schema-fields/schema-fields';
import { childrenOf, type EntryFormNode, referenceFields } from './entry-form';
import { canAddChild } from './expansion-depth';

/**
 * One Entry's Fields, Tags and reference Fields — the root Entry or an embedded child,
 * which are the same form in two modes. Presentation-only: it injects nothing and emits
 * every change to the dialog that owns the tree (ADR 0002). Its own children are rendered
 * by the surrounding Nested list, not by this component.
 */
@Component({
  selector: 'app-entry-node-editor',
  imports: [TranslatePipe, SchemaFields, Combobox],
  template: `
    <section class="node" [class.node--child]="!isRoot()">
      @if (!isRoot()) {
        <header class="node__header">
          <h3 class="node__title" data-testid="node-title">
            {{
              'entries.node.childOf'
                | translate: { field: node().fieldName, tracker: trackerName() }
            }}
          </h3>
          <span class="node__meta" data-testid="node-level">
            {{ 'entries.node.level' | translate: { depth: depth(), cap: cap() } }}
          </span>
          <span class="node__meta" data-testid="node-version">
            {{ 'entries.form.pinnedVersion' | translate: { version: node().trackerVersion } }}
          </span>
          <button
            type="button"
            class="node__remove"
            data-testid="remove-child"
            (click)="removed.emit()"
          >
            {{ 'entries.node.remove' | translate }}
          </button>
        </header>
      }

      <ui-schema-fields
        data-testid="fields"
        [fields]="node().fields"
        [values]="node().values"
        (valuesChange)="valuesChange.emit($event)"
        [problems]="problems()"
        [labels]="{
          required: 'entries.form.required' | translate,
          clear: 'entries.form.clear' | translate,
        }"
        [idPrefix]="node().key"
      />

      <ui-combobox
        data-testid="tags"
        [label]="'entries.form.tags' | translate"
        [removeLabel]="'entries.form.removeTag' | translate"
        [values]="node().tags"
        (valuesChange)="tagsChange.emit($event)"
        [suggestions]="tagSuggestions()"
        (queryChange)="tagQuery.emit($event)"
      />

      @for (field of references(); track field.name) {
        @let problem = problems()[field.name];
        <div class="node__reference" [attr.data-testid]="field.name">
          <span class="node__reference-name">{{ field.name }} ({{ countOf(field) }})</span>
          <button
            type="button"
            data-testid="add-child"
            [disabled]="!canNest() || (field.cardinality === 'one' && countOf(field) > 0)"
            [attr.aria-describedby]="
              problem === undefined ? null : node().key + '-' + field.name + '-error'
            "
            (click)="addChild.emit(field)"
          >
            {{ 'entries.node.add' | translate: { field: field.name } }}
          </button>
          @if (!canNest()) {
            <span class="node__meta" data-testid="cap-reached">{{
              'entries.node.capReached' | translate: { cap: cap() }
            }}</span>
          }
          @if (problem !== undefined) {
            <p
              class="node__error"
              data-testid="error"
              [id]="node().key + '-' + field.name + '-error'"
            >
              {{ problem }}
            </p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .node {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .node--child {
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .node__header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-3);
    }

    .node__title {
      margin: 0;
      font-size: var(--text-md);
    }

    .node__meta {
      color: var(--color-ink-muted);
      font-size: var(--text-sm);
    }

    .node__remove {
      margin-inline-start: auto;
      border: none;
      background: transparent;
      color: var(--color-danger);
      cursor: pointer;
    }

    .node__reference {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .node__reference-name {
      font-weight: var(--weight-medium);
    }

    .node__reference button {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }

    .node__reference button:disabled {
      color: var(--color-ink-muted);
      cursor: not-allowed;
    }

    .node__error {
      flex-basis: 100%;
      margin: 0;
      color: var(--color-danger);
      font-size: var(--text-sm);
    }
  `,
})
export class EntryNodeEditor {
  readonly node = input.required<EntryFormNode>();
  readonly depth = input.required<number>();
  readonly cap = input.required<number>();
  readonly isRoot = input(false);
  readonly trackerName = input('');
  /** Already-translated messages keyed by Field name, for this node only. */
  readonly problems = input<Readonly<Record<string, string>>>({});
  readonly tagSuggestions = input<readonly string[]>([]);

  readonly valuesChange = output<FieldValues>();
  readonly tagsChange = output<readonly string[]>();
  readonly tagQuery = output<string>();
  readonly addChild = output<FieldDef>();
  readonly removed = output<void>();

  protected readonly references = computed<readonly ReferenceFieldDef[]>(() =>
    referenceFields(this.node().fields),
  );
  protected readonly canNest = computed(() => canAddChild(this.depth(), this.cap()));

  protected countOf(field: FieldDef): number {
    return childrenOf(this.node(), field.name).length;
  }
}
