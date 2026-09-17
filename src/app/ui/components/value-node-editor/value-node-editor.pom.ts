import type { Locator } from '@playwright/test';
import { type SchemaFieldObject, SchemaFieldsObject } from '../schema-fields/schema-fields.pom';

/** One reference Field's controls inside a node, scoped by the Field's name. */
export class ReferenceFieldObject {
  constructor(private readonly root: Locator) {}

  get addButton(): Locator {
    return this.root.getByTestId('add-child');
  }

  get error(): Locator {
    return this.root.getByTestId('error');
  }

  get capReached(): Locator {
    return this.root.getByTestId('cap-reached');
  }

  async addChild(): Promise<void> {
    await this.addButton.click();
  }
}

/**
 * A value-tree node — the root or an embedded child. A child's own children render
 * outside its editor element, so everything queried here belongs to this node alone.
 */
export class ValueNodeEditorObject {
  constructor(protected readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  field(name: string): SchemaFieldObject {
    return new SchemaFieldsObject(this.root.getByTestId('fields')).field(name);
  }

  reference(fieldName: string): ReferenceFieldObject {
    return new ReferenceFieldObject(this.root.getByTestId(fieldName));
  }

  get title(): Locator {
    return this.root.getByTestId('node-title');
  }

  get level(): Locator {
    return this.root.getByTestId('node-level');
  }

  async remove(): Promise<void> {
    await this.root.getByTestId('remove-child').click();
  }
}
