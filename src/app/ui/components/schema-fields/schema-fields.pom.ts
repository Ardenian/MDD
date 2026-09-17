import type { Locator } from '@playwright/test';
import { MultiselectObject } from '../multiselect/multiselect.pom';
import { SelectObject } from '../select/select.pom';

/** One Field, scoped by its name — unique within a Tracker Version (ADR 0012). */
export class SchemaFieldObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  get control(): Locator {
    return this.root.getByTestId('control');
  }

  get error(): Locator {
    return this.root.getByTestId('error');
  }

  async fill(value: string): Promise<void> {
    await this.control.fill(value);
  }

  async check(checked: boolean): Promise<void> {
    await this.control.setChecked(checked);
  }

  get select(): SelectObject {
    return new SelectObject(this.control);
  }

  get multiselect(): MultiselectObject {
    return new MultiselectObject(this.control);
  }
}

export class SchemaFieldsObject {
  constructor(private readonly root: Locator) {}

  field(name: string): SchemaFieldObject {
    return new SchemaFieldObject(this.root.getByTestId(name));
  }
}
