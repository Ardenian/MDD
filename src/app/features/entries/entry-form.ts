import type { SnapshotField } from '../../data/model/entry';
import { type FieldDef, isReferenceField } from '../../data/model/field-def';
import { emptyValueFor } from '../../data/model/field-values';
import {
  childrenOf,
  initialValues,
  type StoredValues,
  validateTree,
  type ValueNode,
  type ValueTreeProblems,
} from '../../data/model/value-tree';

/**
 * One Entry in the form: the Entry being edited, or one of its embedded children. The
 * tree operations themselves are the shared ones in `data/model/value-tree.ts`; this adds
 * only what makes a node an Entry — whether it was saved before, and its own Tags.
 */
export interface EntryFormNode extends ValueNode<EntryFormNode> {
  readonly entryId: string | null;
  readonly tags: readonly string[];
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

/** An Entry, unlike a Preset, must satisfy every required Field before it saves. */
export function validateForm(root: EntryFormNode, cap: number): ValueTreeProblems {
  return validateTree(root, cap, { requireValues: true });
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
