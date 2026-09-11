import type { AggregateMeta, Uuid } from './common';

export type TimeMode = 'point' | 'period' | 'dayBucketed';

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

interface FieldBase {
  readonly name: string;
  readonly required: boolean;
}

export interface TextFieldDef extends FieldBase {
  readonly dataType: 'text' | 'longText';
}

export interface NumberFieldDef extends FieldBase {
  readonly dataType: 'integer' | 'decimal';
}

export interface BooleanFieldDef extends FieldBase {
  readonly dataType: 'boolean';
}

export interface SelectFieldDef extends FieldBase {
  readonly dataType: 'singleSelect' | 'multiSelect';
  readonly options: readonly string[];
}

export interface ReferenceFieldDef extends FieldBase {
  readonly dataType: 'reference';
  readonly targetTrackerId: Uuid;
  readonly cardinality: ReferenceCardinality;
}

/** One property in a Tracker Version's schema (CONTEXT.md: Field). */
export type FieldDef =
  | TextFieldDef
  | NumberFieldDef
  | BooleanFieldDef
  | SelectFieldDef
  | ReferenceFieldDef;

/** An immutable, sequentially numbered Field schema for one Tracker (ADR 0005). */
export interface TrackerVersion extends AggregateMeta {
  readonly trackerId: Uuid;
  readonly version: number;
  readonly fields: readonly FieldDef[];
}

/**
 * A Tracker's mutable metadata plus its version pointer and in-progress Draft. Renaming
 * or changing the default Time mode is metadata and never mints a Tracker Version.
 */
export interface Tracker extends AggregateMeta {
  readonly name: string;
  readonly defaultTimeMode: TimeMode;
  /** 0 until the first Draft is committed — a Tracker with no Version yet is unusable
   *  by Entries/Presets. */
  readonly currentVersion: number;
  readonly archived: boolean;
  /** The editor's uncommitted working state; null once there is nothing left unsaved
   *  relative to the current Version. */
  readonly draftFields: readonly FieldDef[] | null;
}

export interface TrackerCreateInput {
  readonly name: string;
  readonly defaultTimeMode: TimeMode;
}

export interface TrackerMetaPatch {
  readonly name?: string;
  readonly defaultTimeMode?: TimeMode;
}
