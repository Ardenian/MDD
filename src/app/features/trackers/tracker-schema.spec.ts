import { analyzeExpansion, validateDraftFields, type TrackerSchemaLookup } from './tracker-schema';
import type { FieldDef } from '../../data/model/tracker';

const text: FieldDef = { name: 'Notes', required: false, dataType: 'text' };
const satisfaction: FieldDef = { name: 'Satisfaction', required: true, dataType: 'integer' };

function referenceField(name: string, targetTrackerId: string): FieldDef {
  return { name, required: false, dataType: 'reference', targetTrackerId, cardinality: 'many' };
}

function selectField(name: string, options: readonly string[]): FieldDef {
  return { name, required: false, dataType: 'singleSelect', options };
}

describe('validateDraftFields', () => {
  it('accepts a Draft with unique, non-empty names', () => {
    expect(validateDraftFields([text, satisfaction])).toEqual([]);
  });

  it('rejects an empty Field name', () => {
    const errors = validateDraftFields([{ ...text, name: '  ' }]);
    expect(errors).toEqual([{ fieldIndex: 0, message: 'Field name is required.' }]);
  });

  it('rejects duplicate Field names within the same Draft', () => {
    const errors = validateDraftFields([text, { ...satisfaction, name: 'Notes' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldIndex).toBe(1);
  });

  it('rejects duplicate select options', () => {
    const field = selectField('Energy', ['low', 'medium', 'low']);
    const errors = validateDraftFields([field]);
    expect(errors).toEqual([{ fieldIndex: 0, message: 'Option "low" is duplicated.' }]);
  });

  it('rejects a reference Field with no target Tracker', () => {
    const errors = validateDraftFields([referenceField('Ingredients', '')]);
    expect(errors).toEqual([
      { fieldIndex: 0, message: 'A reference Field needs a target Tracker.' },
    ]);
  });
});

describe('analyzeExpansion', () => {
  it('reports depth 0 and no cycle for a Draft with no reference Fields', () => {
    const lookup: TrackerSchemaLookup = { fieldsFor: () => [] };
    expect(analyzeExpansion('sleep', [text, satisfaction], lookup, 5)).toEqual({
      maxDepth: 0,
      hasCycle: false,
    });
  });

  it('counts a linear reference chain correctly', () => {
    // meal -> ingredient -> nutrient (leaf)
    const lookup: TrackerSchemaLookup = {
      fieldsFor: (trackerId) => {
        if (trackerId === 'ingredient') {
          return [referenceField('Nutrients', 'nutrient')];
        }
        return [];
      },
    };

    const result = analyzeExpansion('meal', [referenceField('Ingredients', 'ingredient')], lookup, 5);
    expect(result).toEqual({ maxDepth: 2, hasCycle: false });
  });

  it('detects direct self-reference as a cycle without infinite recursion', () => {
    const lookup: TrackerSchemaLookup = {
      fieldsFor: (trackerId) => (trackerId === 'meal' ? [referenceField('Component', 'meal')] : []),
    };

    const result = analyzeExpansion('meal', [referenceField('Component', 'meal')], lookup, 5);
    expect(result.hasCycle).toBe(true);
    expect(result.maxDepth).toBeLessThanOrEqual(5);
  });

  it('detects an indirect cycle (A -> B -> A)', () => {
    const lookup: TrackerSchemaLookup = {
      fieldsFor: (trackerId) => (trackerId === 'b' ? [referenceField('BackToA', 'a')] : []),
    };

    const result = analyzeExpansion('a', [referenceField('ToB', 'b')], lookup, 10);
    expect(result.hasCycle).toBe(true);
  });

  it('does not recurse infinitely on a direct self-reference regardless of the cap', () => {
    const lookup: TrackerSchemaLookup = {
      fieldsFor: () => [referenceField('Self', 'looping')],
    };

    const result = analyzeExpansion('looping', [referenceField('Self', 'looping')], lookup, 3);
    expect(result.hasCycle).toBe(true);
    expect(result.maxDepth).toBeLessThanOrEqual(3);
  });

  it('truncates maxDepth at the cap for a long but acyclic chain, without flagging a cycle', () => {
    // Ten distinct Trackers chained t0 -> t1 -> ... -> t9, no repeats anywhere.
    const lookup: TrackerSchemaLookup = {
      fieldsFor: (trackerId) => {
        const index = Number(trackerId.replace('t', ''));
        return index < 9 ? [referenceField('Next', `t${index + 1}`)] : [];
      },
    };

    const result = analyzeExpansion('t0', [referenceField('Next', 't1')], lookup, 3);

    expect(result.hasCycle).toBe(false);
    expect(result.maxDepth).toBe(3);
  });
});
