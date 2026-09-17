import type { Locator } from '@playwright/test';

/** One Preset row — rows repeat, so each is scoped per instance (ADR 0012). */
export class PresetRowObject {
  constructor(private readonly root: Locator) {}

  get name(): Locator {
    return this.root.getByTestId('preset-name');
  }

  get pinnedVersion(): Locator {
    return this.root.getByTestId('pinned-version');
  }

  get staleBadge(): Locator {
    return this.root.getByTestId('stale-badge');
  }

  /** The id other screens address the Preset by, e.g. the Entry form's Preset picker. */
  async presetId(): Promise<string> {
    return (await this.root.getAttribute('data-preset-id')) ?? '';
  }

  async edit(): Promise<void> {
    await this.root.getByTestId('edit-preset').click();
  }

  async delete(): Promise<void> {
    await this.root.getByTestId('delete-preset').click();
  }
}

export class PresetListObject {
  constructor(private readonly root: Locator) {}

  get rows(): Locator {
    return this.root.getByTestId('preset-row');
  }

  row(index: number): PresetRowObject {
    return new PresetRowObject(this.rows.nth(index));
  }

  get empty(): Locator {
    return this.root.getByTestId('presets-empty');
  }

  get staleSummary(): Locator {
    return this.root.getByTestId('stale-summary');
  }
}
