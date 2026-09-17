import type { SnapshotField } from '../../data/model/entry';
import { type FieldDef, isReferenceField } from '../../data/model/field-def';
import {
  coerceValue,
  emptyValueFor,
  type FieldValueProblem,
  type FieldValues,
  validateValue,
} from '../../data/model/field-values';
import { canAddChild, isReferenceBlocked, ROOT_DEPTH } from './expansion-depth';

/**
 * One Entry in the form: the Entry being edited, or one of its embedded children. The
 * whole form is a tree of these, edited immutably and saved in one pass.
 */
export interface EntryFormNode {
  /** Stable while the form is open, whether or not the Entry has been saved yet. */
  readonly key: string;
  readonly entryId: string | null;
  readonly trackerId: string;
  /** The Version whose Fields render: pinned for a saved Entry, current for a new one. */
  readonly trackerVersion: number;
  /** The reference Field in the parent this child hangs under; `null` for the root. */
  readonly fieldName: string | null;
  readonly fields: readonly FieldDef[];
  /** Scalar Fields only — a reference Field's value is the node's children. */
  readonly values: FieldValues;
  readonly tags: readonly string[];
  readonly children: readonly EntryFormNode[];
}

export type EntryFormProblem = FieldValueProblem | 'depth-cap-reached';

/** Problems keyed by node key, then by Field name. Nodes without problems are absent. */
export type EntryFormProblems = Readonly<
  Record<string, Readonly<Record<string, EntryFormProblem>>>
>;

/** Anything shaped like a Snapshot or a Preset's values. */
export type StoredValues = readonly { readonly fieldName: string; readonly value: unknown }[];

export function scalarFields(fields: readonly FieldDef[]): readonly FieldDef[] {
  return fields.filter((field) => !isReferenceField(field));
}

export function referenceFields(fields: readonly FieldDef[]) {
  return fields.filter(isReferenceField);
}

/**
 * Values for a form rendered against `fields`. A stored value survives only if the Field
 * still exists; a Field nothing stored renders empty. Which Version `fields` came from —
 * a pinned one or the current one — is the caller's business; this never looks.
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

export interface NodeInit {
  readonly key: string;
  readonly entryId?: string | null;
  readonly trackerId: string;
  readonly trackerVersion: number;
  readonly fields: readonly FieldDef[];
  readonly fieldName?: string | null;
  readonly stored?: StoredValues;
  readonly tags?: readonly string[];
  readonly children?: readonly EntryFormNode[];
}

export function createNode(init: NodeInit): EntryFormNode {
  return {
    key: init.key,
    entryId: init.entryId ?? null,
    trackerId: init.trackerId,
    trackerVersion: init.trackerVersion,
    fieldName: init.fieldName ?? null,
    fields: init.fields,
    values: initialValues(init.fields, init.stored),
    tags: [...(init.tags ?? [])],
    children: init.children ?? [],
  };
}

export function childrenOf(node: EntryFormNode, fieldName: string): readonly EntryFormNode[] {
  return node.children.filter((child) => child.fieldName === fieldName);
}

export interface FoundNode {
  readonly node: EntryFormNode;
  readonly depth: number;
}

export function findNode(
  root: EntryFormNode,
  key: string,
  depth = ROOT_DEPTH,
): FoundNode | undefined {
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

export function updateNode(
  root: EntryFormNode,
  key: string,
  change: (node: EntryFormNode) => EntryFormNode,
): EntryFormNode {
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

export function addChild(
  root: EntryFormNode,
  parentKey: string,
  child: EntryFormNode,
): EntryFormNode {
  return updateNode(root, parentKey, (parent) => ({
    ...parent,
    children: [...parent.children, child],
  }));
}

/** The root is the Entry itself, so it is never removable from its own form. */
export function removeNode(root: EntryFormNode, key: string): EntryFormNode {
  if (!root.children.some((child) => child.key === key)) {
    let changed = false;
    const children = root.children.map((child) => {
      const next = removeNode(child, key);
      changed ||= next !== child;
      return next;
    });
    return changed ? { ...root, children } : root;
  }
  return { ...root, children: root.children.filter((child) => child.key !== key) };
}

export function canNestUnder(root: EntryFormNode, parentKey: string, cap: number): boolean {
  const found = findNode(root, parentKey);
  return found !== undefined && canAddChild(found.depth, cap);
}

export function validateForm(root: EntryFormNode, cap: number): EntryFormProblems {
  const problems: Record<string, Record<string, EntryFormProblem>> = {};

  const visit = (node: EntryFormNode, depth: number): void => {
    const nodeProblems: Record<string, EntryFormProblem> = {};
    for (const field of node.fields) {
      if (isReferenceField(field)) {
        const children = childrenOf(node, field.name);
        if (
          isReferenceBlocked({ required: field.required, childCount: children.length, depth, cap })
        ) {
          nodeProblems[field.name] = 'depth-cap-reached';
          continue;
        }
        const problem = validateValue(
          field,
          children.map((child) => child.key),
        );
        if (problem !== null) nodeProblems[field.name] = problem;
      } else {
        const problem = validateValue(field, node.values[field.name]);
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

export function hasProblems(problems: EntryFormProblems): boolean {
  return Object.keys(problems).length > 0;
}

/** One value per Field in Version order; a reference Field stores its children's ids. */
export function toSnapshot(
  node: EntryFormNode,
  idOf: (child: EntryFormNode) => string,
): SnapshotField[] {
  return node.fields.map((field) =>
    isReferenceField(field)
      ? { fieldName: field.name, value: childrenOf(node, field.name).map(idOf) }
      : { fieldName: field.name, value: node.values[field.name] ?? emptyValueFor(field) },
  );
}

export function persistedIds(root: EntryFormNode): ReadonlySet<string> {
  const ids = new Set<string>();
  const visit = (node: EntryFormNode): void => {
    if (node.entryId !== null) ids.add(node.entryId);
    node.children.forEach(visit);
  };
  visit(root);
  return ids;
}
