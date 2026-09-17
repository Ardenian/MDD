import type { Locator } from '@playwright/test';
import { SelectObject } from '../../ui/components/select/select.pom';

export class PlacementEditorObject {
  constructor(private readonly root: Locator) {}

  static within(scope: Locator): PlacementEditorObject {
    return new PlacementEditorObject(scope.getByTestId('placement'));
  }

  get mode(): SelectObject {
    return new SelectObject(this.root.getByTestId('mode'));
  }

  /** `local` is wall-clock `YYYY-MM-DDTHH:mm`, as a datetime-local input takes it. */
  async setAt(local: string): Promise<void> {
    await this.root.getByTestId('at').fill(local);
  }

  async setPeriod(startLocal: string, endLocal: string): Promise<void> {
    await this.root.getByTestId('start').fill(startLocal);
    await this.root.getByTestId('end').fill(endLocal);
  }

  async setDay(day: string): Promise<void> {
    await this.root.getByTestId('day').fill(day);
  }

  async setFadeout(beforeMinutes: number, afterMinutes: number): Promise<void> {
    await this.root.getByTestId('fadeout-before').fill(String(beforeMinutes));
    await this.root.getByTestId('fadeout-after').fill(String(afterMinutes));
  }

  get fadeoutBefore(): Locator {
    return this.root.getByTestId('fadeout-before');
  }

  get problem(): Locator {
    return this.root.getByTestId('placement-problem');
  }

  async now(): Promise<void> {
    await this.root.getByTestId('now').click();
  }
}
