import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { Component, input, model, output, type TemplateRef } from '@angular/core';
import { moveItem } from './reorder';

export interface ReorderableRowContext<T> {
  readonly $implicit: T;
  readonly index: number;
}

/**
 * Drag-reorderable list with an equivalent keyboard path. CDK's drag-drop is
 * pointer-driven and ships no keyboard affordance, so the move up/down buttons are not
 * decoration — they are how this meets the "operable without a pointer" requirement.
 *
 * Imported only inside a lazy feature chunk, per ADR 0006's bundle discipline.
 */
@Component({
  selector: 'ui-reorderable-list',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, NgTemplateOutlet],
  template: `
    <ul class="reorderable" data-testid="reorderable-list" cdkDropList (cdkDropListDropped)="onDrop($event)">
      @for (item of items(); track idOf()(item); let index = $index) {
        <li class="reorderable__row" cdkDrag [attr.data-testid]="idOf()(item)">
          <span class="reorderable__handle" cdkDragHandle data-testid="drag-handle" aria-hidden="true">⠿</span>

          <div class="reorderable__content">
            <ng-container
              [ngTemplateOutlet]="rowTemplate()"
              [ngTemplateOutletContext]="{ $implicit: item, index }"
            />
          </div>

          <span class="reorderable__moves">
            <button
              type="button"
              class="reorderable__move"
              data-testid="move-up"
              [disabled]="index === 0"
              [attr.aria-label]="moveUpLabel()"
              (click)="move(index, index - 1)"
            >
              <span aria-hidden="true">&uarr;</span>
            </button>
            <button
              type="button"
              class="reorderable__move"
              data-testid="move-down"
              [disabled]="index === items().length - 1"
              [attr.aria-label]="moveDownLabel()"
              (click)="move(index, index + 1)"
            >
              <span aria-hidden="true">&darr;</span>
            </button>
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    .reorderable {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .reorderable__row {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .reorderable__handle {
      padding-top: var(--space-2);
      color: var(--color-ink-muted);
      cursor: grab;
    }

    .reorderable__content {
      flex: 1;
      min-width: 0;
    }

    .reorderable__moves {
      display: flex;
      gap: var(--space-1);
    }

    .reorderable__move {
      width: var(--control-height-sm);
      height: var(--control-height-sm);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
    }

    .reorderable__move:disabled {
      color: var(--color-ink-muted);
      cursor: not-allowed;
      opacity: 0.5;
    }

    .cdk-drag-preview {
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
    }

    .cdk-drag-placeholder {
      opacity: 0.4;
    }
  `,
})
export class ReorderableList<T> {
  readonly items = model.required<readonly T[]>();
  readonly idOf = input.required<(item: T) => string>();
  readonly rowTemplate = input.required<TemplateRef<ReorderableRowContext<T>>>();
  readonly moveUpLabel = input('Move up');
  readonly moveDownLabel = input('Move down');

  readonly reordered = output<readonly T[]>();

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  protected move(from: number, to: number): void {
    const next = moveItem(this.items(), from, to);
    this.items.set(next);
    this.reordered.emit(next);
  }
}
