import { Component, computed, input, output } from '@angular/core';
import { canAddChild } from '../../../data/model/expansion-depth';
import type { FieldDef, ReferenceFieldDef } from '../../../data/model/field-def';
import type { FieldValues } from '../../../data/model/field-values';
import { childrenOf, referenceFields, type ValueNode } from '../../../data/model/value-tree';
import { SchemaFields } from '../schema-fields/schema-fields';

/** Any value-tree node — an Entry, a Preset, or whatever else pairs values with a schema. */
export interface AnyValueNode extends ValueNode<AnyValueNode> {}

/** Already translated by the consumer; `ui/` components inject nothing, a translator included. */
export interface ValueNodeLabels {
  readonly required: string;
  readonly clear: string;
  readonly remove: string;
  readonly childOf: (fieldName: string, trackerName: string) => string;
  readonly level: (depth: number, cap: number) => string;
  readonly version: (version: number) => string;
  readonly addTo: (fieldName: string) => string;
  readonly capReached: (cap: number) => string;
}

/**
 * One node of a value tree: its Fields, its reference Fields' add buttons, and — for a
 * child — a header naming where it sits. The root and an embedded child are the same
 * editor in two modes. Shared by the Entry form and the Preset editor, so it lives here
 * rather than in either feature; each feature projects its own extras (the Entry form's
 * Tags input) into the slot after the Fields. A node's own children are rendered by the
 * surrounding Nested list, not by this component.
 */
@Component({
  selector: 'ui-value-node-editor',
  imports: [SchemaFields],
  template: `
    <section class="node" [class.node--child]="!isRoot()">
      @if (!isRoot()) {
        <header class="node__header">
          <h3 class="node__title" data-testid="node-title">
            {{ labels().childOf(node().fieldName ?? '', trackerName()) }}
          </h3>
          <span class="node__meta" data-testid="node-level">{{
            labels().level(depth(), cap())
          }}</span>
          <span class="node__meta" data-testid="node-version">{{
            labels().version(node().trackerVersion)
          }}</span>
          <button
            type="button"
            class="node__remove"
            data-testid="remove-child"
            (click)="removed.emit()"
          >
            {{ labels().remove }}
          </button>
        </header>
      }

      <ui-schema-fields
        data-testid="fields"
        [fields]="node().fields"
        [values]="node().values"
        (valuesChange)="valuesChange.emit($event)"
        [problems]="problems()"
        [labels]="{ required: labels().required, clear: labels().clear }"
        [idPrefix]="node().key"
      />

      <ng-content />

      @for (field of references(); track field.name) {
        @let problem = problems()[field.name];
        @let errorId = node().key + '-' + field.name + '-error';
        <div class="node__reference" [attr.data-testid]="field.name">
          <span class="node__reference-name">{{ field.name }} ({{ countOf(field) }})</span>
          <button
            type="button"
            data-testid="add-child"
            [disabled]="!canNest() || (field.cardinality === 'one' && countOf(field) > 0)"
            [attr.aria-describedby]="problem === undefined ? null : errorId"
            (click)="addChild.emit(field)"
          >
            {{ labels().addTo(field.name) }}
          </button>
          @if (!canNest()) {
            <span class="node__meta" data-testid="cap-reached">{{
              labels().capReached(cap())
            }}</span>
          }
          @if (problem !== undefined) {
            <p class="node__error" data-testid="error" [id]="errorId">{{ problem }}</p>
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
export class ValueNodeEditor {
  readonly node = input.required<AnyValueNode>();
  readonly depth = input.required<number>();
  readonly cap = input.required<number>();
  readonly labels = input.required<ValueNodeLabels>();
  readonly isRoot = input(false);
  readonly trackerName = input('');
  /** Already-translated messages keyed by Field name, for this node only. */
  readonly problems = input<Readonly<Record<string, string>>>({});

  readonly valuesChange = output<FieldValues>();
  readonly addChild = output<ReferenceFieldDef>();
  readonly removed = output<void>();

  protected readonly references = computed(() => referenceFields(this.node().fields));
  protected readonly canNest = computed(() => canAddChild(this.depth(), this.cap()));

  protected countOf(field: FieldDef): number {
    return childrenOf(this.node(), field.name).length;
  }
}
