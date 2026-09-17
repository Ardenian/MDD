import { type FieldDef, isReferenceField, isSelectField } from '../../data/model/field-def';

export type FieldProblem =
  | { readonly kind: 'empty-name'; readonly index: number }
  | { readonly kind: 'duplicate-name'; readonly index: number; readonly name: string }
  | { readonly kind: 'empty-option-set'; readonly index: number }
  | { readonly kind: 'duplicate-option'; readonly index: number; readonly option: string }
  | { readonly kind: 'missing-reference-target'; readonly index: number };

/**
 * Draft validity. Deliberately says nothing about expansion depth: the designer never
 * checks it, not even for a self-reference — the cap is enforced where Entries are
 * actually nested (`entries/SPEC.md`).
 */
export function findFieldProblems(fields: readonly FieldDef[]): readonly FieldProblem[] {
  const problems: FieldProblem[] = [];
  const seen = new Map<string, number>();

  fields.forEach((field, index) => {
    const name = field.name.trim();
    if (name === '') {
      problems.push({ kind: 'empty-name', index });
    } else {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        problems.push({ kind: 'duplicate-name', index, name });
      } else {
        seen.set(key, index);
      }
    }

    if (isSelectField(field)) {
      problems.push(...selectProblems(field.options, index));
    }

    if (isReferenceField(field) && field.targetTrackerId.trim() === '') {
      problems.push({ kind: 'missing-reference-target', index });
    }
  });

  return problems;
}

function selectProblems(options: readonly string[], index: number): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (options.length === 0) {
    problems.push({ kind: 'empty-option-set', index });
  }
  const seen = new Set<string>();
  for (const option of options) {
    const key = option.trim().toLowerCase();
    if (seen.has(key)) {
      problems.push({ kind: 'duplicate-option', index, option });
    }
    seen.add(key);
  }
  return problems;
}

export function isDraftValid(fields: readonly FieldDef[]): boolean {
  return findFieldProblems(fields).length === 0;
}

/** True when committing would mint a new Tracker Version rather than being a no-op. */
export function draftDiffersFromVersion(
  draftFields: readonly FieldDef[],
  versionFields: readonly FieldDef[] | undefined,
): boolean {
  if (versionFields === undefined) {
    return draftFields.length > 0;
  }
  return !fieldsMatch(draftFields, versionFields);
}

function fieldsMatch(a: readonly FieldDef[], b: readonly FieldDef[]): boolean {
  return a.length === b.length && a.every((field, index) => sameField(field, b[index]));
}

function sameField(field: FieldDef, other: FieldDef | undefined): boolean {
  if (other === undefined) {
    return false;
  }
  if (
    field.name !== other.name ||
    field.required !== other.required ||
    field.dataType !== other.dataType
  ) {
    return false;
  }
  if (isSelectField(field) && isSelectField(other)) {
    return (
      field.options.length === other.options.length &&
      field.options.every((option, index) => option === other.options[index])
    );
  }
  if (isReferenceField(field) && isReferenceField(other)) {
    return (
      field.targetTrackerId === other.targetTrackerId && field.cardinality === other.cardinality
    );
  }
  return true;
}

/** A Preset is stale once its Tracker has moved past the Version it pins to (ADR 0005). */
export function isPresetStale(presetVersion: number, currentVersion: number): boolean {
  return presetVersion < currentVersion;
}

/** Deep copy, so editing a Preset never reaches back into the Entry it came from. */
export function deepCopyValues<T>(values: T): T {
  return structuredClone(values);
}
