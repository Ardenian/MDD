import type { Page } from '@playwright/test';
import type { FieldDataType } from '../../src/app/data/model/field-def';
import { TrackerDesignerPageObject } from '../../src/app/features/trackers/tracker-designer-page.pom';
import { TrackersPageObject } from '../../src/app/features/trackers/trackers-page.pom';

export interface TrackerFieldSpec {
  readonly name: string;
  readonly dataType: FieldDataType;
  readonly required?: boolean;
  readonly options?: readonly string[];
  readonly targetTrackerId?: string;
  readonly cardinality?: 'one' | 'many';
}

export interface CreateTrackerOptions {
  readonly name: string;
  readonly fields?: readonly TrackerFieldSpec[];
  /** Leave false to stop at an uncommitted Draft. */
  readonly commit?: boolean;
}

/**
 * Creates a Tracker and (by default) commits its first Version, returning the Tracker's
 * id so later steps can address it. Flows are the one place test code composes Page
 * Object Models across features (ADR 0013).
 */
export async function createTracker(page: Page, options: CreateTrackerOptions): Promise<string> {
  const list = new TrackersPageObject(page);
  await list.open();
  await list.createTracker(options.name);

  const designer = new TrackerDesignerPageObject(page);
  const trackerId = await designer.trackerId();

  for (const [index, field] of (options.fields ?? []).entries()) {
    await designer.addField();
    const row = designer.field(index);
    await row.setName(field.name);
    await row.dataType.choose(field.dataType);

    if (field.required === true) {
      await row.setRequired(true);
    }
    for (const option of field.options ?? []) {
      await row.addOption(option);
    }
    if (field.targetTrackerId !== undefined) {
      await row.referenceTarget.choose(field.targetTrackerId);
    }
    if (field.cardinality !== undefined) {
      await row.referenceCardinality.choose(field.cardinality);
    }
  }

  if (options.commit !== false && (options.fields ?? []).length > 0) {
    await designer.commit();
  }

  return trackerId;
}
