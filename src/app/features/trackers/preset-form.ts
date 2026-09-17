import { isReferenceField } from '../../data/model/field-def';
import { isEmptyValue } from '../../data/model/field-values';
import type { PresetChild, PresetFieldValue, PresetInput } from '../../data/model/preset';
import {
  initialValues,
  type NodeParts,
  scalarFields,
  validateTree,
  type ValueNode,
  type ValueTreeProblems,
} from '../../data/model/value-tree';

/** A Preset, or one of its filled children, while it is being edited. */
export type PresetFormNode = ValueNode<PresetFormNode>;

export function createPresetNode(key: string, parts: NodeParts<PresetFormNode>): PresetFormNode {
  return {
    key,
    trackerId: parts.trackerId,
    trackerVersion: parts.trackerVersion,
    fieldName: parts.fieldName,
    fields: parts.fields,
    values: initialValues(parts.fields, parts.stored),
    children: parts.children,
  };
}

export interface PresetProblems {
  readonly nameMissing: boolean;
  readonly tree: ValueTreeProblems;
}

/**
 * A Preset is a partial pre-fill, so no Field is required — only the shape of what it
 * does fill is checked, plus a name to pick it by. Nesting still honours the expansion-depth
 * cap, because Preset children become real child Entries when used (entries/SPEC.md).
 */
export function validatePreset(name: string, root: PresetFormNode, cap: number): PresetProblems {
  return {
    nameMissing: name.trim() === '',
    tree: validateTree(root, cap, { requireValues: false }),
  };
}

/**
 * Stores only what was filled in: a value left empty is simply not covered, which is what
 * makes a used Preset render that Field empty (ADR 0005). Every node records the Version
 * it was authored against, so staleness stays checkable per child.
 */
export function toPresetInput(trackerId: string, name: string, root: PresetFormNode): PresetInput {
  return {
    trackerId,
    name: name.trim(),
    values: coveredValues(root),
    children: root.children.map(toPresetChild),
  };
}

function toPresetChild(node: PresetFormNode): PresetChild {
  return {
    fieldName: node.fieldName ?? '',
    trackerId: node.trackerId,
    trackerVersion: node.trackerVersion,
    values: coveredValues(node),
    children: node.children.map(toPresetChild),
  };
}

function coveredValues(node: PresetFormNode): PresetFieldValue[] {
  return scalarFields(node.fields)
    .filter((field) => !isReferenceField(field) && !isEmptyValue(field, node.values[field.name]))
    .map((field) => ({ fieldName: field.name, value: structuredClone(node.values[field.name]) }));
}
