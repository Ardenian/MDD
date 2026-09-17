import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { FieldDef } from '../../data/model/field-def';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { TAG_REPOSITORY } from '../../data/ports/tag-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { createInMemoryDataLayer, type DataLayer } from '../../data/testing/in-memory-data-layer';
import { EntriesDataAccess } from './entries-data-access';
import { addChild, removeNode, updateNode } from './entry-form';

const grams: FieldDef = { name: 'grams', required: false, dataType: 'decimal' };
const energy: FieldDef = {
  name: 'Energy',
  required: false,
  dataType: 'singleSelect',
  options: ['low', 'high'],
};

describe('EntriesDataAccess', () => {
  let layer: DataLayer;
  let access: EntriesDataAccess;

  beforeEach(async () => {
    layer = createInMemoryDataLayer();
    TestBed.configureTestingModule({
      providers: [
        { provide: ENTRY_REPOSITORY, useValue: layer.entries },
        { provide: TRACKER_REPOSITORY, useValue: layer.trackers },
        { provide: PRESET_REPOSITORY, useValue: layer.presets },
        { provide: TAG_REPOSITORY, useValue: layer.tags },
        { provide: SETTINGS_REPOSITORY, useValue: layer.settings },
      ],
    });
    access = TestBed.inject(EntriesDataAccess);
    await TestBed.inject(ApplicationRef).whenStable();
  });

  async function mealAndIngredient() {
    const ingredient = await layer.trackers.create({
      name: 'Ingredient',
      defaultTimeMode: 'point',
      fields: [grams],
    });
    const ingredients: FieldDef = {
      name: 'Ingredients',
      required: false,
      dataType: 'reference',
      targetTrackerId: ingredient.id,
      cardinality: 'many',
    };
    const meal = await layer.trackers.create({
      name: 'Meal',
      defaultTimeMode: 'period',
      fields: [energy, ingredients],
    });
    return { meal, ingredient, ingredients };
  }

  it('starts a new Entry at the Tracker’s current Version and default Time mode', async () => {
    const { meal } = await mealAndIngredient();

    const form = await access.open({ trackerId: meal.id, at: '2026-03-01T10:00:00.000Z' });

    expect(form.isNew).toBe(true);
    expect(form.root.trackerVersion).toBe(1);
    expect(form.placement).toEqual({
      kind: 'period',
      start: '2026-03-01T10:00:00.000Z',
      end: '2026-03-01T11:00:00.000Z',
    });
  });

  it('refuses to start an Entry for a Tracker with no committed Version', async () => {
    const snack = await layer.trackers.create({ name: 'Snack', defaultTimeMode: 'point' });

    await expect(access.open({ trackerId: snack.id })).rejects.toMatchObject({ code: 'invalid' });
  });

  it('saves an Entry with its children, each pinned to its own Tracker’s current Version', async () => {
    const { meal, ingredient, ingredients } = await mealAndIngredient();
    const form = await access.open({ trackerId: meal.id, at: '2026-03-01T10:00:00.000Z' });
    let child = await access.newChild(ingredients, 1, 5);
    child = { ...child, values: { grams: 120 }, tags: ['dairy'] };

    const saved = await access.save(
      {
        root: { ...addChild(form.root, form.root.key, child), values: { Energy: 'high' } },
        placement: form.placement,
      },
      new Set(),
    );

    const children = await layer.entries.listChildren(saved.id);
    expect(saved.snapshot).toEqual([
      { fieldName: 'Energy', value: 'high' },
      { fieldName: 'Ingredients', value: [children[0]?.id] },
    ]);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      trackerId: ingredient.id,
      trackerVersion: 1,
      tags: ['dairy'],
      snapshot: [{ fieldName: 'grams', value: 120 }],
      placement: form.placement,
    });
    expect(saved.tags).toEqual([]);
  });

  it('reopens a saved Entry against its pinned Version, not today’s schema', async () => {
    const { meal } = await mealAndIngredient();
    const form = await access.open({ trackerId: meal.id });
    const saved = await access.save(
      { root: { ...form.root, values: { Energy: 'low' } }, placement: form.placement },
      new Set(),
    );

    await layer.trackers.saveDraft(meal.id, [{ ...energy, name: 'EnergyLevel' }]);
    await layer.trackers.commitDraft(meal.id);
    const reopened = await access.open({ entryId: saved.id });

    expect(reopened.root.trackerVersion).toBe(1);
    expect(reopened.root.fields.map((field) => field.name)).toEqual(['Energy', 'Ingredients']);
    expect(reopened.root.values).toEqual({ Energy: 'low' });
    expect(reopened.currentVersion).toBe(2);
  });

  it('soft-deletes a child removed from the form, and updates the rest in place', async () => {
    const { meal, ingredients } = await mealAndIngredient();
    const form = await access.open({ trackerId: meal.id });
    const first = await access.newChild(ingredients, 1, 5);
    const second = await access.newChild(ingredients, 1, 5);
    const saved = await access.save(
      {
        root: addChild(addChild(form.root, form.root.key, first), form.root.key, second),
        placement: form.placement,
      },
      new Set(),
    );

    const reopened = await access.open({ entryId: saved.id });
    const [keep, drop] = reopened.root.children;
    const edited = updateNode(removeNode(reopened.root, drop!.key), keep!.key, (node) => ({
      ...node,
      values: { grams: 5 },
    }));
    await access.save(
      { root: edited, placement: reopened.placement },
      access.originalIds(reopened.root),
    );

    const children = await layer.entries.listChildren(saved.id);
    expect(children.map((child) => child.id)).toEqual([keep!.entryId]);
    expect(children[0]?.snapshot).toEqual([{ fieldName: 'grams', value: 5 }]);
    await expect(layer.entries.get(drop!.entryId!)).resolves.toMatchObject({
      deletedAt: expect.any(String),
    });
    await expect(layer.entries.get(saved.id)).resolves.toMatchObject({
      snapshot: [
        { fieldName: 'Energy', value: null },
        { fieldName: 'Ingredients', value: [keep!.entryId] },
      ],
    });
  });

  it('copies a Preset into a fresh Entry at the current Version, whatever the Preset pins to', async () => {
    const { meal, ingredient } = await mealAndIngredient();
    const preset = await layer.presets.create({
      trackerId: meal.id,
      name: 'Full English',
      values: [
        { fieldName: 'Energy', value: 'high' },
        { fieldName: 'Retired', value: 'gone' },
      ],
      children: [
        {
          fieldName: 'Ingredients',
          trackerId: ingredient.id,
          trackerVersion: 1,
          values: [{ fieldName: 'grams', value: 2 }],
          children: [],
        },
      ],
    });
    await layer.trackers.saveDraft(meal.id, [
      energy,
      { ...grams, name: 'Portion' },
      await mealAndIngredientField(meal.id),
    ]);
    await layer.trackers.commitDraft(meal.id);

    const form = await access.open({ trackerId: meal.id, presetId: preset.id });

    expect(form.root.trackerVersion).toBe(2);
    expect(form.root.values).toEqual({ Energy: 'high', Portion: null });
    expect(form.root.children.map((child) => child.values)).toEqual([{ grams: 2 }]);
    await expect(layer.presets.get(preset.id)).resolves.toMatchObject({ trackerVersion: 1 });

    async function mealAndIngredientField(mealId: string): Promise<FieldDef> {
      const version = await layer.trackers.getVersion(mealId, 1);
      return version!.fields.find((field) => field.name === 'Ingredients')!;
    }
  });

  it('will not nest a child past the expansion-depth cap', async () => {
    const { ingredients } = await mealAndIngredient();

    await expect(access.newChild(ingredients, 2, 2)).rejects.toMatchObject({ code: 'invalid' });
  });

  it('reads a lowered cap the next time a form opens, without a reload', async () => {
    const { meal } = await mealAndIngredient();
    await expect(access.open({ trackerId: meal.id })).resolves.toMatchObject({
      expansionDepthCap: 5,
    });

    await layer.settings.save({ expansionDepthCap: 3 });

    await expect(access.open({ trackerId: meal.id })).resolves.toMatchObject({
      expansionDepthCap: 3,
    });
  });
});
