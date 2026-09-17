import type { FieldDef } from './field-def';

/**
 * What a Field holds in a form, a Snapshot or a Preset. A reference Field holds the ids
 * of its child Entries, in creation order.
 */
export type FieldValue = string | number | boolean | readonly string[] | null;

export type FieldValues = Readonly<Record<string, FieldValue>>;

export type FieldValueProblem =
  'required' | 'not-an-integer' | 'not-a-number' | 'unknown-option' | 'too-many-children';

export function emptyValueFor(field: FieldDef): FieldValue {
  switch (field.dataType) {
    case 'text':
    case 'longText':
      return '';
    case 'boolean':
      return false;
    case 'multiSelect':
    case 'reference':
      return [];
    default:
      return null;
  }
}

/** A boolean is never "missing": unchecked is an answer, not an absence. */
export function isEmptyValue(field: FieldDef, value: FieldValue | undefined): boolean {
  if (field.dataType === 'boolean') {
    return false;
  }
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return Array.isArray(value) && value.length === 0;
}

export function validateValue(
  field: FieldDef,
  value: FieldValue | undefined,
): FieldValueProblem | null {
  if (isEmptyValue(field, value)) {
    return field.required ? 'required' : null;
  }
  switch (field.dataType) {
    case 'integer':
      if (typeof value !== 'number' || Number.isNaN(value)) return 'not-a-number';
      return Number.isInteger(value) ? null : 'not-an-integer';
    case 'decimal':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'not-a-number';
    case 'singleSelect':
      return typeof value === 'string' && field.options.includes(value) ? null : 'unknown-option';
    case 'multiSelect':
      return Array.isArray(value) && value.every((option) => field.options.includes(option))
        ? null
        : 'unknown-option';
    case 'reference':
      return field.cardinality === 'one' && Array.isArray(value) && value.length > 1
        ? 'too-many-children'
        : null;
    default:
      return null;
  }
}

export function validateValues(
  fields: readonly FieldDef[],
  values: FieldValues,
): Readonly<Record<string, FieldValueProblem>> {
  const problems: Record<string, FieldValueProblem> = {};
  for (const field of fields) {
    const problem = validateValue(field, values[field.name]);
    if (problem !== null) {
      problems[field.name] = problem;
    }
  }
  return problems;
}

/**
 * Reads a stored value (a Snapshot or a Preset is `unknown` by contract) into the shape
 * its Field holds. A shape the Field cannot hold becomes empty rather than throwing, so
 * one odd stored value never stops an Entry from opening.
 */
export function coerceValue(field: FieldDef, raw: unknown): FieldValue {
  switch (field.dataType) {
    case 'text':
    case 'longText':
      return typeof raw === 'string' ? raw : '';
    case 'integer':
    case 'decimal':
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    case 'boolean':
      return typeof raw === 'boolean' ? raw : false;
    case 'singleSelect':
      return typeof raw === 'string' ? raw : null;
    case 'multiSelect':
    case 'reference':
      return Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string')
        : [];
  }
}
