import type { FieldDef } from '../model/tracker';

/**
 * Structural equality for a Draft's Fields against a Tracker Version's Fields, used by
 * `commitDraft` to decide whether committing actually changes anything (order matters:
 * reordering Fields is itself a schema change).
 */
export function fieldDefsEqual(a: readonly FieldDef[], b: readonly FieldDef[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((field, index) => fieldDefEqual(field, b[index]));
}

function fieldDefEqual(a: FieldDef, b: FieldDef): boolean {
  if (a.name !== b.name || a.required !== b.required || a.dataType !== b.dataType) {
    return false;
  }

  if (a.dataType === 'singleSelect' || a.dataType === 'multiSelect') {
    const bOptions = (b as { options: readonly string[] }).options;
    return arraysEqual(a.options, bOptions);
  }

  if (a.dataType === 'reference') {
    const reference = b as { targetTrackerId: string; cardinality: string };
    return a.targetTrackerId === reference.targetTrackerId && a.cardinality === reference.cardinality;
  }

  return true;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
