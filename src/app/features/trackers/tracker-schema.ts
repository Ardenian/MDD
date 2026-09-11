import type { Uuid } from '../../data/model/common';
import type { FieldDef } from '../../data/model/tracker';

export interface FieldValidationError {
  readonly fieldIndex: number;
  readonly message: string;
}

/**
 * Validates a Draft's Fields in isolation (name uniqueness/non-emptiness, select
 * option uniqueness, a reference Field naming its target) — everything that can be
 * checked without consulting any other Tracker. `trackers/SPEC.md`.
 */
export function validateDraftFields(fields: readonly FieldDef[]): readonly FieldValidationError[] {
  const errors: FieldValidationError[] = [];
  const seenNames = new Set<string>();

  fields.forEach((field, fieldIndex) => {
    const name = field.name.trim();

    if (name.length === 0) {
      errors.push({ fieldIndex, message: 'Field name is required.' });
    } else if (seenNames.has(name)) {
      errors.push({ fieldIndex, message: `Field name "${name}" is already used in this Draft.` });
    }
    seenNames.add(name);

    if (field.dataType === 'singleSelect' || field.dataType === 'multiSelect') {
      const seenOptions = new Set<string>();
      for (const option of field.options) {
        if (seenOptions.has(option)) {
          errors.push({ fieldIndex, message: `Option "${option}" is duplicated.` });
        }
        seenOptions.add(option);
      }
    }

    if (field.dataType === 'reference' && field.targetTrackerId.trim().length === 0) {
      errors.push({ fieldIndex, message: 'A reference Field needs a target Tracker.' });
    }
  });

  return errors;
}

/** Looks up another Tracker's *current committed* Fields — Drafts don't participate in
 *  cross-Tracker expansion, only committed schemas do. */
export interface TrackerSchemaLookup {
  fieldsFor(trackerId: Uuid): readonly FieldDef[];
}

export interface ExpansionAnalysis {
  /** Capped at `depthCap` even when a cycle would otherwise make this unbounded. */
  readonly maxDepth: number;
  readonly hasCycle: boolean;
}

/**
 * Walks a Draft's reference Fields (and, transitively, every Tracker they reach) to
 * find the deepest possible child-Entry nesting and detect cycles. Self-reference and
 * cycles are allowed (Q22) — this only powers the non-blocking "this can build an
 * infinite form" warning at commit time (`trackers/SPEC.md`); it never blocks a commit.
 */
export function analyzeExpansion(
  rootTrackerId: Uuid,
  rootFields: readonly FieldDef[],
  lookup: TrackerSchemaLookup,
  depthCap: number,
): ExpansionAnalysis {
  let maxDepth = 0;
  let hasCycle = false;

  function walk(fields: readonly FieldDef[], depth: number, ancestors: ReadonlySet<Uuid>): void {
    maxDepth = Math.max(maxDepth, depth);
    if (depth >= depthCap) {
      return;
    }

    for (const field of fields) {
      if (field.dataType !== 'reference') {
        continue;
      }

      if (ancestors.has(field.targetTrackerId)) {
        hasCycle = true;
        maxDepth = Math.max(maxDepth, depth + 1);
        continue;
      }

      walk(
        lookup.fieldsFor(field.targetTrackerId),
        depth + 1,
        new Set([...ancestors, field.targetTrackerId]),
      );
    }
  }

  walk(rootFields, 0, new Set([rootTrackerId]));
  return { maxDepth, hasCycle };
}
