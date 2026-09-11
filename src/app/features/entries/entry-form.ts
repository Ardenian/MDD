import type { SnapshotField } from '../../data/model/entry';
import type { PresetFieldValue } from '../../data/model/preset';
import type { FieldDef } from '../../data/model/tracker';

export interface FieldInputModel {
  readonly field: FieldDef;
  readonly value: unknown;
}

/**
 * Builds the form model for a set of Fields (a Tracker Version's — current for a new
 * Entry, pinned for an existing one, per `entries/SPEC.md`), optionally pre-filled from
 * a Preset. A Field the Preset didn't cover renders its data-type default; a Preset
 * value whose Field no longer exists in `fields` is naturally dropped (never looked up).
 */
export function buildEntryFormModel(
  fields: readonly FieldDef[],
  presetValues: readonly PresetFieldValue[] = [],
): readonly FieldInputModel[] {
  const valueByFieldName = new Map(presetValues.map((entry) => [entry.fieldName, entry.value]));

  return fields.map((field) => ({
    field,
    value: valueByFieldName.has(field.name) ? valueByFieldName.get(field.name) : defaultValueFor(field),
  }));
}

export function formModelToSnapshot(model: readonly FieldInputModel[]): readonly SnapshotField[] {
  return model.map(({ field, value }) => ({ fieldName: field.name, value }));
}

/** Required Fields left empty — includes a required reference Field whose child list is
 *  empty because the expansion-depth cap prevented adding one (`entries/SPEC.md`). */
export function missingRequiredFields(model: readonly FieldInputModel[]): readonly FieldDef[] {
  return model.filter(({ field, value }) => field.required && isEmptyValue(value)).map(({ field }) => field);
}

export function isEntryFormValid(model: readonly FieldInputModel[]): boolean {
  return missingRequiredFields(model).length === 0;
}

function defaultValueFor(field: FieldDef): unknown {
  switch (field.dataType) {
    case 'text':
    case 'longText':
      return '';
    case 'integer':
    case 'decimal':
      return null;
    case 'boolean':
      return false;
    case 'singleSelect':
      return null;
    case 'multiSelect':
    case 'reference':
      return [];
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}
