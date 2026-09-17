import { CdkTableModule } from '@angular/cdk/table';
import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PairResult } from './discovery';
import { nextSort, type ResultColumn, type ResultSort, sortResults } from './results-sort';

export interface ResultRow {
  readonly result: PairResult;
  readonly pinned: boolean;
}

const COLUMNS: readonly ResultColumn[] = [
  'seriesA',
  'seriesB',
  'lag',
  'coefficient',
  'n',
  'significance',
];

/**
 * The ranked results, on `cdk/table` — headless, so this feature owns the columns and
 * the styling. CDK ships no sort primitive, so the clickable headers drive
 * `results-sort.ts`, which is where the ordering rules are tested (ADR 0006).
 *
 * Presentation-only: it injects nothing and reports clicks upward.
 */
@Component({
  selector: 'app-results-table',
  imports: [TranslatePipe, CdkTableModule],
  template: `
    <table cdk-table [dataSource]="rows()" class="results" data-testid="results-table">
      @for (column of columns; track column) {
        <ng-container [cdkColumnDef]="column">
          <th
            cdk-header-cell
            *cdkHeaderCellDef
            scope="col"
            [attr.data-testid]="'header-' + column"
            [attr.aria-sort]="ariaSort(column)"
          >
            <button
              type="button"
              class="results__sort"
              [attr.data-testid]="'sort-' + column"
              (click)="sort.emit(nextFor(column))"
            >
              {{ 'correlation.results.' + column | translate }}
              @if (currentSort().column === column) {
                <span aria-hidden="true">{{ currentSort().direction === 'asc' ? '↑' : '↓' }}</span>
              }
            </button>
          </th>
          <td cdk-cell *cdkCellDef="let row" [attr.data-testid]="column">
            {{ cell(row, column) }}
          </td>
        </ng-container>
      }

      <ng-container cdkColumnDef="actions">
        <th cdk-header-cell *cdkHeaderCellDef scope="col">
          <span class="visually-hidden">{{ 'correlation.results.actions' | translate }}</span>
        </th>
        <td cdk-cell *cdkCellDef="let row">
          <button type="button" data-testid="open-pair" (click)="opened.emit(row.result.id)">
            {{ 'correlation.results.open' | translate }}
          </button>
          <button
            type="button"
            data-testid="pin-pair"
            [attr.aria-pressed]="row.pinned"
            (click)="pinned.emit(row.result.id)"
          >
            {{ (row.pinned ? 'correlation.results.unpin' : 'correlation.results.pin') | translate }}
          </button>
        </td>
      </ng-container>

      <tr cdk-header-row *cdkHeaderRowDef="allColumns"></tr>
      <tr cdk-row *cdkRowDef="let row; columns: allColumns" [attr.data-testid]="row.result.id"></tr>
    </table>
  `,
  styles: `
    .results {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
    }

    .results th,
    .results td {
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--color-border);
      text-align: left;
    }

    .results__sort {
      display: inline-flex;
      gap: var(--space-2);
      border: none;
      background: none;
      padding: 0;
      color: inherit;
      font: inherit;
      font-weight: var(--weight-medium);
      cursor: pointer;
    }
  `,
})
export class ResultsTable {
  readonly results = input.required<readonly PairResult[]>();
  readonly pinnedIds = input<readonly string[]>([]);
  readonly currentSort = input.required<ResultSort>();

  readonly sort = output<ResultSort>();
  readonly opened = output<string>();
  readonly pinned = output<string>();

  protected readonly columns = COLUMNS;
  protected readonly allColumns = [...COLUMNS, 'actions'];

  protected readonly rows = computed<readonly ResultRow[]>(() =>
    sortResults(this.results(), this.currentSort()).map((result) => ({
      result,
      pinned: this.pinnedIds().includes(result.id),
    })),
  );

  protected nextFor(column: ResultColumn): ResultSort {
    return nextSort(this.currentSort(), column);
  }

  protected ariaSort(column: ResultColumn): 'ascending' | 'descending' | 'none' {
    if (this.currentSort().column !== column) {
      return 'none';
    }
    return this.currentSort().direction === 'asc' ? 'ascending' : 'descending';
  }

  protected cell(row: ResultRow, column: ResultColumn): string {
    const { result } = row;
    switch (column) {
      case 'seriesA':
        return label(result.a.path, result.a.name);
      case 'seriesB':
        return label(result.b.path, result.b.name);
      case 'lag':
        return result.lag > 0 ? `+${result.lag}` : String(result.lag);
      case 'coefficient':
        return result.coefficient.toFixed(2);
      case 'n':
        return String(result.n);
      case 'significance':
        return result.adjustedP < 0.001 ? '<0.001' : result.adjustedP.toFixed(3);
    }
  }
}

function label(path: string, name: string): string {
  return [path, name].filter((part) => part !== '').join(' · ');
}
