import type { Locator } from '@playwright/test';

/** One row, scoped by the item's own id — collisions resolved by nesting (ADR 0012). */
export class ReorderableRowObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  async moveUp(): Promise<void> {
    await this.root.getByTestId('move-up').click();
  }

  async moveDown(): Promise<void> {
    await this.root.getByTestId('move-down').click();
  }
}

export class ReorderableListObject {
  constructor(private readonly root: Locator) {}

  static within(scope: Locator): ReorderableListObject {
    return new ReorderableListObject(scope.getByTestId('reorderable-list'));
  }

  row(id: string): ReorderableRowObject {
    return new ReorderableRowObject(this.root.getByTestId(id));
  }

  async rowCount(): Promise<number> {
    return this.root.getByTestId('drag-handle').count();
  }
}
