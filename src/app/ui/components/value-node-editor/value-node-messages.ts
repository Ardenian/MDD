import type { ValueTreeProblems } from '../../../data/model/value-tree';
import type { ValueNodeLabels } from './value-node-editor';

/**
 * A translation lookup, passed in rather than injected: this module is pure, so it can
 * be used by any feature's top-level component without `ui/` reaching for a service.
 */
export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * Problem messages by node key, then by Field name. Named because the raw shape says
 * nothing about which string is which.
 */
export type ValueTreeMessages = Partial<Record<string, Record<string, string>>>;

/**
 * The editor's own labels, from the `valueTree.*` keys in the common namespace.
 *
 * Both consumers — the Entry form and the Preset editor — render the same component
 * against the same keys, so building the map twice only invited them to drift.
 */
export function valueNodeLabels(instant: TranslateFn): ValueNodeLabels {
  return {
    required: instant('valueTree.required'),
    clear: instant('valueTree.clear'),
    remove: instant('valueTree.node.remove'),
    childOf: (field, tracker) => instant('valueTree.node.childOf', { field, tracker }),
    level: (depth, cap) => instant('valueTree.node.level', { depth, cap }),
    version: (version) => instant('valueTree.version', { version }),
    addTo: (field) => instant('valueTree.node.add', { field }),
    capReached: (cap) => instant('valueTree.node.capReached', { cap }),
  };
}

/** Turns validation problems into the messages the editor shows beside each control. */
export function translateValueTreeProblems(
  problems: ValueTreeProblems,
  instant: TranslateFn,
  cap: number,
): ValueTreeMessages {
  const messages: ValueTreeMessages = {};
  for (const [key, fields] of Object.entries(problems)) {
    messages[key] = Object.fromEntries(
      Object.entries(fields ?? {}).map(([field, problem]) => [
        field,
        instant(`valueTree.problems.${problem}`, { cap }),
      ]),
    );
  }
  return messages;
}
