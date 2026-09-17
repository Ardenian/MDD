export type FieldDataType =
  | 'text'
  | 'longText'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'singleSelect'
  | 'multiSelect'
  | 'reference';

export type ReferenceCardinality = 'one' | 'many';

interface FieldDefBase {
  readonly name: string;
  readonly required: boolean;
}

export interface TextFieldDef extends FieldDefBase {
  readonly dataType: 'text' | 'longText';
}

export interface NumberFieldDef extends FieldDefBase {
  readonly dataType: 'integer' | 'decimal';
}

export interface BooleanFieldDef extends FieldDefBase {
  readonly dataType: 'boolean';
}

export interface SelectFieldDef extends FieldDefBase {
  readonly dataType: 'singleSelect' | 'multiSelect';
  readonly options: readonly string[];
}

export interface ReferenceFieldDef extends FieldDefBase {
  readonly dataType: 'reference';
  readonly targetTrackerId: string;
  readonly cardinality: ReferenceCardinality;
}

/** One property in a Tracker Version's schema. */
export type FieldDef =
  TextFieldDef | NumberFieldDef | BooleanFieldDef | SelectFieldDef | ReferenceFieldDef;

export function isSelectField(field: FieldDef): field is SelectFieldDef {
  return field.dataType === 'singleSelect' || field.dataType === 'multiSelect';
}

export function isReferenceField(field: FieldDef): field is ReferenceFieldDef {
  return field.dataType === 'reference';
}

export function isNumericField(field: FieldDef): field is NumberFieldDef {
  return field.dataType === 'integer' || field.dataType === 'decimal';
}

function fieldEquals(a: FieldDef, b: FieldDef): boolean {
  if (a.name !== b.name || a.required !== b.required || a.dataType !== b.dataType) {
    return false;
  }
  if (isSelectField(a) && isSelectField(b)) {
    return (
      a.options.length === b.options.length &&
      a.options.every((option, index) => option === b.options[index])
    );
  }
  if (isReferenceField(a) && isReferenceField(b)) {
    return a.targetTrackerId === b.targetTrackerId && a.cardinality === b.cardinality;
  }
  return true;
}

/**
 * Order-sensitive: Fields are a sequence, so reordering them is a schema change worth a
 * new Tracker Version. Decides whether committing a Draft mints anything (ADR 0005).
 */
export function fieldsEqual(a: readonly FieldDef[], b: readonly FieldDef[]): boolean {
  return (
    a.length === b.length &&
    a.every((field, index) => {
      const other = b[index];
      return other !== undefined && fieldEquals(field, other);
    })
  );
}
