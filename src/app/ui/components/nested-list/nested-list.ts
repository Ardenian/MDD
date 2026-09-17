import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, type TemplateRef } from '@angular/core';
import { boundedChildrenAccessor } from './bounded-children';

export interface NestedNodeContext<T> {
  readonly $implicit: T;
  readonly depth: number;
}

/**
 * A nest of arbitrary nodes rendered as real nested lists, which is what conveys the
 * hierarchy to assistive technology. Deliberately not `cdk/tree`: that imposes
 * tree/treeitem semantics and roving focus, which suit a navigable tree widget but make a
 * nest of *editable forms* (embedded child Entries) behave like a menu (ui/SPEC.md).
 *
 * Expansion stops at `cap` and at any node that is already its own ancestor, so a
 * self-referencing Tracker cannot make it render forever.
 */
@Component({
  selector: 'ui-nested-list',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #level let-nodes let-depth="depth">
      <ul class="nested" [attr.data-testid]="depth === startDepth() ? 'nested-list' : 'nested-children'">
        @for (node of nodes; track idOf()(node)) {
          <li class="nested__item">
            <ng-container [ngTemplateOutlet]="nodeTemplate()" [ngTemplateOutletContext]="{ $implicit: node, depth }" />
            @if (childrenOf()(node).length > 0) {
              <ng-container
                [ngTemplateOutlet]="level"
                [ngTemplateOutletContext]="{ $implicit: childrenOf()(node), depth: depth + 1 }"
              />
            }
          </li>
        }
      </ul>
    </ng-template>

    <ng-container [ngTemplateOutlet]="level" [ngTemplateOutletContext]="{ $implicit: nodes(), depth: startDepth() }" />
  `,
  styles: `
    .nested {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .nested .nested {
      margin-top: var(--space-3);
      padding-inline-start: var(--space-5);
      border-inline-start: 2px solid var(--color-border);
    }
  `,
})
export class NestedList<T> {
  readonly nodes = input.required<readonly T[]>();
  readonly idOf = input.required<(node: T) => string>();
  readonly childrenAccessor = input.required<(node: T) => readonly T[]>();
  readonly nodeTemplate = input.required<TemplateRef<NestedNodeContext<T>>>();
  readonly cap = input.required<number>();
  /** The depth the top-level nodes sit at, when they are themselves somebody's children. */
  readonly startDepth = input(1);

  protected readonly childrenOf = computed(() =>
    boundedChildrenAccessor(this.nodes(), {
      // The accessor counts its roots as depth 1; shift the cap by where they really sit.
      cap: this.cap() - this.startDepth() + 1,
      idOf: this.idOf(),
      childrenOf: this.childrenAccessor(),
    }),
  );
}
