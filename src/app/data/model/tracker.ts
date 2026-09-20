import type { AggregateMeta } from './aggregate-meta';
import type { FieldDeclarations } from './field-declaration';
import type { FieldDef } from './field-def';

export type TimeMode = 'point' | 'period' | 'dayBucketed';

/**
 * A Tracker's header. The Field schema lives on TrackerVersion, not here (ADR 0005).
 */
export interface Tracker extends AggregateMeta {
  readonly name: string;
  readonly defaultTimeMode: TimeMode;
  /** Highest committed TrackerVersion.version; 0 until the first commit. */
  readonly currentVersion: number;
  readonly archived: boolean;
  readonly draftFields: readonly FieldDef[];
  /** Absent until a Field is declared; unversioned metadata, like `defaultTimeMode`. */
  readonly fieldDeclarations?: FieldDeclarations;
}

export interface TrackerCreateInput {
  readonly name: string;
  readonly defaultTimeMode: TimeMode;
  /** Committed immediately as Version 1 when non-empty; otherwise the Tracker starts at Version 0 with an empty Draft. */
  readonly fields?: readonly FieldDef[];
}

export interface TrackerMetaInput {
  readonly name?: string;
  readonly defaultTimeMode?: TimeMode;
}
