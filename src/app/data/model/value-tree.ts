import { canAddChild, isReferenceBlocked, ROOT_DEPTH } from './expansion-depth';
import { type FieldDef, isReferenceField, type ReferenceFieldDef } from './field-def';
import {
  coerceValue,
  emptyValueFor,
  type FieldValueProblem,
  type FieldValues,
  validateValue,
} from './field-values';

/**
 * One node of a value tree: values filled in against a Tracker Version's Fields, whose
 * reference Fields hold further nodes. An Entry with its embedded children is one such
 * tree; a Preset with its filled children is another. The operations here are shared by
 * both, so neither feature re-derives them (ADR 0002's promote-on-second-use).
 */
export interface ValueNode<Self extends ValueNode<Self>> {
  /** Stable while the tree is being edited, whether or not the node was saved before. */
  readonly key: string;
  readonly trackerId: string;
  /** The Version whose Fields the node renders against. */
  readonly trackerVersion: number;
  /** The reference Field in the parent this node hangs under; `null` for the root. */
  readonly fieldName: string | null;
  readonly fields: readonly FieldDef[];
  /** Scalar Fields only — a reference Field's value is the node's children. */
  readonly values: FieldValues;
  readonly children: readonly Self[];
}

/** Anything shaped like a Snapshot or a Preset's values. */
export type StoredValues = readonly { readonly fieldName: string; readonly value: unknown }[];

export type ValueTreeProblem = FieldValueProblem | 'depth-cap-reached';

/** Problems keyed by node key, then by Field name. Nodes without problems are absent. */
export type ValueTreeProblems = Readonly<
  Partial<Record<string, Readonly<Record<string, ValueTreeProblem>>>>
>;

export function scalarFields(fields: readonly FieldDef[]): readonly FieldDef[] {
  return fields.filter((field) => !isReferenceField(field));
}

export function referenceFields(fields: readonly FieldDef[]): readonly ReferenceFieldDef[] {
  return fields.filter(isReferenceField);
}

/**
 * Values for a node rendered against `fields`. A stored value survives only if its Field
 * still exists; a Field nothing stored renders empty. Whether `fields` is a pinned or the
 * current Version is the caller's business — this never looks.
 */
export function initialValues(fields: readonly FieldDef[], stored: StoredValues = []): FieldValues {
  const byName = new Map(stored.map((entry) => [entry.fieldName, entry.value]));
  const values: Record<string, FieldValues[string]> = {};
  for (const field of scalarFields(fields)) {
    values[field.name] = byName.has(field.name)
      ? coerceValue(field, structuredClone(byName.get(field.name)))
      : emptyValueFor(field);
  }
  return values;
}

export function childrenOf<T extends ValueNode<T>>(node: T, fieldName: string): readonly T[] {
  return node.children.filter((child) => child.fieldName === fieldName);
}

export interface FoundNode<T> {
  readonly node: T;
  readonly depth: number;
}

export function findNode<T extends ValueNode<T>>(
  root: T,
  key: string,
  depth = ROOT_DEPTH,
): FoundNode<T> | undefined {
  if (root.key === key) {
    return { node: root, depth };
  }
  for (const child of root.children) {
    const found = findNode(child, key, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export function updateNode<T extends ValueNode<T>>(
  root: T,
  key: string,
  change: (node: T) => T,
): T {
  if (root.key === key) {
    return change(root);
  }
  let changed = false;
  const children = root.children.map((child) => {
    const next = updateNode(child, key, change);
    changed ||= next !== child;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export function addChild<T extends ValueNode<T>>(root: T, parentKey: string, child: T): T {
  return updateNode(root, parentKey, (parent) => ({
    ...parent,
    children: [...parent.children, child],
  }));
}

/** The root is the thing being edited, so it is never removable from its own tree. */
export function removeNode<T extends ValueNode<T>>(root: T, key: string): T {
  if (root.children.some((child) => child.key === key)) {
    return { ...root, children: root.children.filter((child) => child.key !== key) };
  }
  let changed = false;
  const children = root.children.map((child) => {
    const next = removeNode(child, key);
    changed ||= next !== child;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export interface ValidateTreeOptions {
  /**
   * An Entry must satisfy every required Field; a Preset is a partial pre-fill, so only
   * the *shape* of what it does fill is checked.
   */
  readonly requireValues: boolean;
}

export function validateTree<T extends ValueNode<T>>(
  root: T,
  cap: number,
  options: ValidateTreeOptions,
): ValueTreeProblems {
  const problems: Record<string, Record<string, ValueTreeProblem>> = {};

  const visit = (node: T, depth: number): void => {
    const nodeProblems: Record<string, ValueTreeProblem> = {};
    for (const field of node.fields) {
      const checked = options.requireValues ? field : { ...field, required: false };
      if (isReferenceField(checked)) {
        const children = childrenOf(node, field.name);
        if (
          isReferenceBlocked({
            required: checked.required,
            childCount: children.length,
            depth,
            cap,
          })
        ) {
          nodeProblems[field.name] = 'depth-cap-reached';
          continue;
        }
        const problem = validateValue(
          checked,
          children.map((child) => child.key),
        );
        if (problem !== null) nodeProblems[field.name] = problem;
      } else {
        const problem = validateValue(checked, node.values[field.name]);
        if (problem !== null) nodeProblems[field.name] = problem;
      }
    }
    if (Object.keys(nodeProblems).length > 0) {
      problems[node.key] = nodeProblems;
    }
    node.children.forEach((child) => visit(child, depth + 1));
  };

  visit(root, ROOT_DEPTH);
  return problems;
}

export function hasProblems(problems: ValueTreeProblems): boolean {
  return Object.keys(problems).length > 0;
}

export function problemCount(problems: ValueTreeProblems): number {
  return Object.values(problems).reduce(
    (count, fields) => count + Object.keys(fields ?? {}).length,
    0,
  );
}

export interface StoredChild {
  readonly fieldName: string;
  readonly values: StoredValues;
  readonly children: readonly StoredChild[];
}

export interface CurrentSchema {
  readonly trackerId: string;
  readonly trackerVersion: number;
  readonly fields: readonly FieldDef[];
}

export interface NodeParts<T> {
  readonly trackerId: string;
  readonly trackerVersion: number;
  readonly fields: readonly FieldDef[];
  readonly fieldName: string | null;
  readonly stored: StoredValues;
  readonly children: readonly T[];
}

/**
 * Rebuilds a stored value tree (a Preset's values and filled children) against each
 * Tracker's *current* Version: values match by Field name, a child whose reference Field
 * no longer exists is dropped, a child's Tracker is whatever its reference Field targets
 * today, and nothing nests past the cap (ADR 0005).
 */
export async function treeFromStored<T extends ValueNode<T>>(
  root: {
    readonly trackerId: string;
    readonly values: StoredValues;
    readonly children: readonly StoredChild[];
  },
  cap: number,
  currentSchema: (trackerId: string) => Promise<CurrentSchema>,
  make: (parts: NodeParts<T>) => T,
): Promise<T> {
  const build = async (
    trackerId: string,
    fieldName: string | null,
    values: StoredValues,
    storedChildren: readonly StoredChild[],
    depth: number,
  ): Promise<T> => {
    const schema = await currentSchema(trackerId);
    const children: T[] = [];
    if (canAddChild(depth, cap)) {
      for (const storedChild of storedChildren) {
        const field = referenceFields(schema.fields).find(
          (candidate) => candidate.name === storedChild.fieldName,
        );
        if (field !== undefined) {
          children.push(
            await build(
              field.targetTrackerId,
              field.name,
              storedChild.values,
              storedChild.children,
              depth + 1,
            ),
          );
        }
      }
    }
    return make({
      trackerId: schema.trackerId,
      trackerVersion: schema.trackerVersion,
      fields: schema.fields,
      fieldName,
      stored: values,
      children,
    });
  };

  return build(root.trackerId, null, root.values, root.children, ROOT_DEPTH);
}
