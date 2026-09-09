import "@typespec/http";
import "@typespec/rest";

using Http;
using Rest;

/**
 * Diary Calendar API contract — the single source of truth (ADR 0004).
 *
 * This is the starting shape. Evolve it alongside `src/app/data/SPEC.md`; every
 * persisted aggregate must keep the `AggregateMeta` fields (ADR 0003). Regenerate the
 * client after any change: `pnpm --filter @ard/api-spec build` then the client
 * generator script.
 */
@service(#{ title: "Diary Calendar API" })
namespace DiaryCalendar;

// ---------------------------------------------------------------------------
// Shared scalars & metadata
// ---------------------------------------------------------------------------

alias Uuid = string;
alias Timestamp = utcDateTime;

/** Fields carried by every persisted aggregate. See ADR 0003. */
model AggregateMeta {
  /** Client-generated UUID. */
  @visibility(Lifecycle.Read)
  id: Uuid;

  @visibility(Lifecycle.Read)
  createdAt: Timestamp;

  @visibility(Lifecycle.Read)
  updatedAt: Timestamp;

  /** Set when soft-deleted; default reads exclude these rows. */
  @visibility(Lifecycle.Read)
  deletedAt: Timestamp | null;

  /** Monotonic per-record counter for conflict detection. */
  @visibility(Lifecycle.Read)
  revision: int32;

  @visibility(Lifecycle.Read)
  ownerId: string;

  @visibility(Lifecycle.Read)
  userId: string;
}

@error
model ApiError {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Trackers
// ---------------------------------------------------------------------------

enum TimeMode {
  point,
  period,
  dayBucketed,
}

enum FieldDataType {
  text,
  longText,
  integer,
  decimal,
  boolean,
  singleSelect,
  multiSelect,
  reference,
}

enum ReferenceCardinality {
  one,
  many,
}

model FieldBase {
  name: string;
  required: boolean;
}

model TextFieldDef extends FieldBase {
  dataType: FieldDataType.text | FieldDataType.longText;
}

model NumberFieldDef extends FieldBase {
  dataType: FieldDataType.integer | FieldDataType.decimal;
}

model BooleanFieldDef extends FieldBase {
  dataType: FieldDataType.boolean;
}

model SelectFieldDef extends FieldBase {
  dataType: FieldDataType.singleSelect | FieldDataType.multiSelect;
  options: string[];
}

model ReferenceFieldDef extends FieldBase {
  dataType: FieldDataType.reference;
  targetTrackerId: Uuid;
  cardinality: ReferenceCardinality;
}

/** One property in a Tracker Version's schema. */
union FieldDef {
  text: TextFieldDef,
  number: NumberFieldDef,
  boolean: BooleanFieldDef,
  select: SelectFieldDef,
  reference: ReferenceFieldDef,
}

/**
 * A Tracker's header: identity, metadata, and its current place in its own version
 * history. The Field schema itself lives on `TrackerVersion`, not here. See ADR 0005.
 */
model Tracker {
  ...AggregateMeta;
  name: string;
  defaultTimeMode: TimeMode;
  /** The highest committed TrackerVersion.version. 0 until the first commit. */
  currentVersion: int32;
  /** Hidden from "create new" / reference-target pickers; never migrated, never deleted. */
  archived: boolean;
  /** Uncommitted working schema; equals the current Version's fields right after a commit. */
  draftFields: FieldDef[];
}

model TrackerCreateInput {
  name: string;
  defaultTimeMode: TimeMode;
  /** Committed immediately as Version 1. */
  fields: FieldDef[];
}

model TrackerMetaInput {
  name?: string;
  defaultTimeMode?: TimeMode;
}

/**
 * An immutable, sequentially numbered snapshot of a Tracker's Field schema. Never
 * updated or deleted — an Entry's Snapshot pins to one of these forever. See ADR 0005.
 */
model TrackerVersion {
  ...AggregateMeta;
  trackerId: Uuid;
  /** Sequential per Tracker, starting at 1. */
  version: int32;
  fields: FieldDef[];
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

model PresetFieldValue {
  fieldName: string;
  /** Shape depends on the Field's data type. */
  value: unknown;
}

model Preset {
  ...AggregateMeta;
  trackerId: Uuid;
  /** The Tracker Version this Preset's values were authored against. */
  trackerVersion: int32;
  name: string;
  values: PresetFieldValue[];
  /** Filled child Entries for reference Fields, resolved depth-first. */
  children: PresetChild[];
}

model PresetChild {
  fieldName: string;
  trackerId: Uuid;
  trackerVersion: int32;
  values: PresetFieldValue[];
  children: PresetChild[];
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

model Fadeout {
  beforeMinutes: int32;
  afterMinutes: int32;
}

model PointPlacement {
  kind: "point";
  at: Timestamp;
  fadeout?: Fadeout;
}

model PeriodPlacement {
  kind: "period";
  start: Timestamp;
  end: Timestamp;
  fadeout?: Fadeout;
}

model DayBucketedPlacement {
  kind: "dayBucketed";
  day: plainDate;
}

union Placement {
  point: PointPlacement,
  period: PeriodPlacement,
  dayBucketed: DayBucketedPlacement,
}

/**
 * A Field value frozen onto an Entry. No dataType or schema copy — that's looked up
 * from the Entry's pinned `(trackerId, trackerVersion)` TrackerVersion. See ADR 0005.
 */
model SnapshotField {
  fieldName: string;
  value: unknown;
}

model Entry {
  ...AggregateMeta;
  trackerId: Uuid;
  /** The Tracker Version current when this Entry was created. Immutable thereafter. */
  trackerVersion: int32;
  /** Zero or one parent; a child's placement always mirrors its parent's. */
  parentEntryId: Uuid | null;
  placement: Placement;
  snapshot: SnapshotField[];
  tags: string[];
}

/**
 * No `trackerVersion` field: the adapter resolves it from the target Tracker's
 * `currentVersion` at creation time — a caller never supplies it. See ADR 0005.
 */
model EntryInput {
  trackerId: Uuid;
  parentEntryId: Uuid | null;
  placement: Placement;
  snapshot: SnapshotField[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// Routes (starting surface — mirror src/app/data/SPEC.md ports)
// ---------------------------------------------------------------------------

@route("/trackers")
namespace Trackers {
  @get op list(): Tracker[];
  @get op read(@path id: Uuid): Tracker | ApiError;
  /** Creates the Tracker header and commits its Field schema as Version 1. */
  @post op create(@body input: TrackerCreateInput): Tracker;
  /** Renames / changes default Time mode. Never versions. */
  @patch op updateMeta(@path id: Uuid, @body input: TrackerMetaInput): Tracker | ApiError;
  /** Replaces the working Draft. Does not version until `commitDraft` is called. */
  @put
  @route("/{id}/draft")
  op saveDraft(@path id: Uuid, @body fields: FieldDef[]): Tracker | ApiError;
  /** Mints `currentVersion + 1` iff the Draft differs from the current Version. */
  @post
  @route("/{id}/draft/commit")
  op commitDraft(@path id: Uuid): Tracker | ApiError;
  @get
  @route("/{id}/versions/{version}")
  op readVersion(@path id: Uuid, @path version: int32): TrackerVersion | ApiError;
  @post
  @route("/{id}/archive")
  op archive(@path id: Uuid): Tracker | ApiError;
  @post
  @route("/{id}/unarchive")
  op unarchive(@path id: Uuid): Tracker | ApiError;
}

@route("/entries")
namespace Entries {
  @get op list(@query from: Timestamp, @query to: Timestamp, @query includeChildren?: boolean): Entry[];
  @get op read(@path id: Uuid): Entry | ApiError;
  @post op create(@body input: EntryInput): Entry;
  @patch op update(@path id: Uuid, @body input: EntryInput): Entry | ApiError;
  @delete op remove(@path id: Uuid): void | ApiError;
}

@route("/presets")
namespace Presets {
  @get op list(@query trackerId: Uuid): Preset[];
  @post op create(@body preset: Preset): Preset;
  @patch op update(@path id: Uuid, @body preset: Preset): Preset | ApiError;
  @delete op remove(@path id: Uuid): void | ApiError;
}

@route("/tags")
namespace Tags {
  @get op list(@query prefix?: string): string[];
}
