import type { Locator } from '@playwright/test';
import { ComboboxObject } from '../../ui/components/combobox/combobox.pom';
import {
  SchemaFieldsObject,
  type SchemaFieldObject,
} from '../../ui/components/schema-fields/schema-fields.pom';

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
 * The root Entry or one embedded child. A child's own children render outside its editor
 * element, so everything queried here belongs to this node alone.
 */
export class EntryNodeEditorObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  field(name: string): SchemaFieldObject {
    return new SchemaFieldsObject(this.root.getByTestId('fields')).field(name);
  }

  get tags(): ComboboxObject {
    return new ComboboxObject(this.root.getByTestId('tags'));
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
