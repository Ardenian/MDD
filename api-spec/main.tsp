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

/** One property in a Tracker's schema. */
union FieldDef {
  text: TextFieldDef,
  number: NumberFieldDef,
  boolean: BooleanFieldDef,
  select: SelectFieldDef,
  reference: ReferenceFieldDef,
}

model Tracker {
  ...AggregateMeta;
  name: string;
  defaultTimeMode: TimeMode;
  fields: FieldDef[];
}

model TrackerInput {
  name: string;
  defaultTimeMode: TimeMode;
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
  name: string;
  values: PresetFieldValue[];
  /** Filled child Entries for reference Fields, resolved depth-first. */
  children: PresetChild[];
}

model PresetChild {
  fieldName: string;
  trackerId: Uuid;
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

/** A Field frozen onto an Entry; binds to a live Tracker Field by (name, dataType). */
model SnapshotField {
  name: string;
  dataType: FieldDataType;
  value: unknown;
}

model Entry {
  ...AggregateMeta;
  trackerId: Uuid;
  /** Zero or one parent; a child's placement always mirrors its parent's. */
  parentEntryId: Uuid | null;
  placement: Placement;
  snapshot: SnapshotField[];
  tags: string[];
}

model EntryInput {
  trackerId: Uuid;
  parentEntryId: Uuid | null;
  placement: Placement;
  snapshot: SnapshotField[];
  tags: string[];
}

/** Required when deleting a Tracker that still has Entries. */
model MigrationPlan {
  targetTrackerId: Uuid;
  mappings: FieldMapping[];
}

model FieldMapping {
  sourceFieldName: string;
  /** null = leave unmapped; the value is retained as an Orphaned Field. */
  targetFieldName: string | null;
}

// ---------------------------------------------------------------------------
// Routes (starting surface — mirror src/app/data/SPEC.md ports)
// ---------------------------------------------------------------------------

@route("/trackers")
namespace Trackers {
  @get op list(): Tracker[];
  @get op read(@path id: Uuid): Tracker | ApiError;
  @post op create(@body input: TrackerInput): Tracker;
  @patch op update(@path id: Uuid, @body input: TrackerInput): Tracker | ApiError;
  @delete op remove(@path id: Uuid, @body plan: MigrationPlan): void | ApiError;
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
