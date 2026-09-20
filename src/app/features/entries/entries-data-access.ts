import { Injectable, computed, inject, Injector, resource, type Signal } from '@angular/core';
import { DataError } from '../../data/model/data-error';
import type { Entry } from '../../data/model/entry';
import { type FieldDef, isReferenceField } from '../../data/model/field-def';
import { coerceValue } from '../../data/model/field-values';
import type { Placement } from '../../data/model/placement';
import type { Preset } from '../../data/model/preset';
import { DEFAULT_SETTINGS } from '../../data/model/settings';
import type { TimeMode, Tracker } from '../../data/model/tracker';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { TAG_REPOSITORY } from '../../data/ports/tag-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { createNode, type EntryFormNode, persistedIds, toSnapshot } from './entry-form';
import { canAddChild } from '../../data/model/expansion-depth';
import { type CurrentSchema, treeFromStored } from '../../data/model/value-tree';
import { withTimeMode } from './fadeout';

export interface EntryFormRequest {
  /** Open a saved Entry, rendered against the Version it pins to. */
  readonly entryId?: string;
  /** Start a new Entry of this Tracker, at its current Version. */
  readonly trackerId?: string;
  readonly presetId?: string;
  /** Where a new Entry starts; defaults to now. */
  readonly at?: string;
  /** Overrides the Tracker's default Time mode — the Calendar's "Now" asks for a Point. */
  readonly mode?: TimeMode;
}

export interface EntryForm {
  readonly root: EntryFormNode;
  readonly placement: Placement;
  readonly isNew: boolean;
  /** The Tracker's current Version, for the header badge on a new Entry. */
  readonly currentVersion: number;
  /**
   * Read fresh each time a form opens, so lowering it in Settings applies the next time
   * the user nests — not after a reload (settings/SPEC.md).
   */
  readonly expansionDepthCap: number;
}

export interface TrackerHeader {
  readonly id: string;
  readonly name: string;
  readonly currentVersion: number;
}

/**
 * Stateless DataAccess (ADR 0008). The form's working state — the tree being edited — is
 * the dialog's own; this only reads it in and writes it back out.
 */
@Injectable()
export class EntriesDataAccess {
  private readonly entries = inject(ENTRY_REPOSITORY);
  private readonly trackers = inject(TRACKER_REPOSITORY);
  private readonly presets = inject(PRESET_REPOSITORY);
  private readonly tags = inject(TAG_REPOSITORY);
  private readonly settings = inject(SETTINGS_REPOSITORY);
  private readonly injector = inject(Injector);

  /** Call from an injection context. */
  presetsFor(trackerId: Signal<string | null>): Signal<readonly Preset[]> {
    const presets = resource({
      injector: this.injector,
      params: () => trackerId(),
      loader: ({ params }) =>
        params === null ? Promise.resolve([]) : this.presets.listByTracker(params),
      defaultValue: [],
    });
    return computed(() => presets.value());
  }

  /** Call from an injection context. */
  tagSuggestionsFor(query: Signal<string>): Signal<readonly string[]> {
    const suggestions = resource({
      injector: this.injector,
      params: () => query().trim(),
      loader: ({ params }) => this.tags.suggest(params),
      defaultValue: [],
    });
    return computed(() => suggestions.value().map((suggestion) => suggestion.name));
  }

  async trackerHeader(trackerId: string): Promise<TrackerHeader> {
    const tracker = await this.requireTracker(trackerId);
    return { id: tracker.id, name: tracker.name, currentVersion: tracker.currentVersion };
  }

  async open(request: EntryFormRequest): Promise<EntryForm> {
    const expansionDepthCap = await this.readExpansionDepthCap();
    if (request.entryId !== undefined) {
      const entry = await this.requireEntry(request.entryId);
      const tracker = await this.requireTracker(entry.trackerId);
      return {
        root: await this.loadSaved(entry, null),
        placement: entry.placement,
        isNew: false,
        currentVersion: tracker.currentVersion,
        expansionDepthCap,
      };
    }
    if (request.trackerId === undefined) {
      throw new DataError('invalid', 'An Entry form needs an Entry or a Tracker to start from');
    }

    const tracker = await this.requireCommittedTracker(request.trackerId);
    const at =
      request.at !== undefined && !Number.isNaN(Date.parse(request.at))
        ? request.at
        : new Date().toISOString();
    const placement = withTimeMode({ kind: 'point', at }, request.mode ?? tracker.defaultTimeMode);
    const root =
      request.presetId === undefined
        ? await this.newNode(tracker.id, null)
        : await this.fromPreset(request.presetId, expansionDepthCap);
    return {
      root,
      placement,
      isNew: true,
      currentVersion: tracker.currentVersion,
      expansionDepthCap,
    };
  }

  /** A child always snapshots its own Tracker's *current* Version, not its parent's. */
  async newChild(field: FieldDef, parentDepth: number, cap: number): Promise<EntryFormNode> {
    if (!isReferenceField(field)) {
      throw new DataError('invalid', `${field.name} is not a reference Field`);
    }
    if (!canAddChild(parentDepth, cap)) {
      throw new DataError('invalid', 'The expansion-depth cap is reached');
    }
    return this.newNode(field.targetTrackerId, field.name);
  }

  /**
   * Deep-copies a Preset into a fresh root, whatever Version the Preset pins to: values
   * are matched to the Tracker's current Version by Field name, uncovered Fields start
   * empty, and a value for a Field that no longer exists is dropped (ADR 0005).
   */
  async fromPreset(presetId: string, cap: number): Promise<EntryFormNode> {
    const preset = await this.presets.get(presetId);
    if (preset === undefined || preset.deletedAt !== null) {
      throw new DataError('not-found', `Preset ${presetId} does not exist`);
    }
    return treeFromStored<EntryFormNode>(
      preset,
      cap,
      (trackerId) => this.currentSchema(trackerId),
      (parts) => createNode({ key: crypto.randomUUID(), ...parts }),
    );
  }

  async save(
    form: { readonly root: EntryFormNode; readonly placement: Placement },
    original: ReadonlySet<string>,
  ): Promise<Entry> {
    const kept = new Set<string>();

    const persist = async (node: EntryFormNode, parentEntryId: string | null): Promise<string> => {
      const base = {
        trackerId: node.trackerId,
        parentEntryId,
        placement: form.placement,
        tags: node.tags,
      };
      // A new node's children do not exist yet, so its first write holds no references;
      // the second write below fills them in once they have ids.
      const id =
        node.entryId ??
        (
          await this.entries.create({
            ...base,
            snapshot: toSnapshot({ ...node, children: [] }, () => ''),
          })
        ).id;
      kept.add(id);

      const childIds = new Map<string, string>();
      for (const child of node.children) {
        childIds.set(child.key, await persist(child, id));
      }
      if (node.entryId !== null || node.children.length > 0) {
        await this.entries.update(id, {
          ...base,
          snapshot: toSnapshot(node, (child) => childIds.get(child.key) ?? ''),
        });
      }
      return id;
    };

    const rootId = await persist(
      form.root,
      form.root.entryId === null ? null : await this.parentOf(form.root.entryId),
    );
    for (const removed of original) {
      if (!kept.has(removed)) {
        await this.entries.softDelete(removed);
      }
    }
    return this.requireEntry(rootId);
  }

  async delete(entryId: string): Promise<void> {
    await this.entries.softDelete(entryId);
  }

  originalIds(root: EntryFormNode): ReadonlySet<string> {
    return persistedIds(root);
  }

  private async loadSaved(entry: Entry, fieldName: string | null): Promise<EntryFormNode> {
    const version = await this.trackers.getVersion(entry.trackerId, entry.trackerVersion);
    if (version === undefined) {
      throw new DataError(
        'not-found',
        `Tracker Version ${entry.trackerVersion} of ${entry.trackerId} does not exist`,
      );
    }
    const children: EntryFormNode[] = [];
    for (const field of version.fields.filter(isReferenceField)) {
      const stored = entry.snapshot.find((value) => value.fieldName === field.name)?.value;
      for (const childId of coerceValue(field, stored) as readonly string[]) {
        const child = await this.entries.get(childId);
        if (child !== undefined && child.deletedAt === null) {
          children.push(await this.loadSaved(child, field.name));
        }
      }
    }
    return createNode({
      key: crypto.randomUUID(),
      entryId: entry.id,
      trackerId: entry.trackerId,
      trackerVersion: entry.trackerVersion,
      fields: version.fields,
      fieldName,
      stored: entry.snapshot,
      tags: entry.tags,
      children,
    });
  }

  private async newNode(trackerId: string, fieldName: string | null): Promise<EntryFormNode> {
    const schema = await this.currentSchema(trackerId);
    return createNode({ key: crypto.randomUUID(), ...schema, fieldName });
  }

  private async currentSchema(trackerId: string): Promise<CurrentSchema> {
    const tracker = await this.requireCommittedTracker(trackerId);
    const version = await this.trackers.getVersion(tracker.id, tracker.currentVersion);
    return {
      trackerId: tracker.id,
      trackerVersion: tracker.currentVersion,
      fields: version?.fields ?? [],
    };
  }

  private async readExpansionDepthCap(): Promise<number> {
    return (await this.settings.get()).expansionDepthCap ?? DEFAULT_SETTINGS.expansionDepthCap;
  }

  private async parentOf(entryId: string): Promise<string | null> {
    return (await this.requireEntry(entryId)).parentEntryId;
  }

  private async requireEntry(id: string): Promise<Entry> {
    const entry = await this.entries.get(id);
    if (entry === undefined || entry.deletedAt !== null) {
      throw new DataError('not-found', `Entry ${id} does not exist`);
    }
    return entry;
  }

  private async requireTracker(id: string): Promise<Tracker> {
    const tracker = await this.trackers.get(id);
    if (tracker === undefined || tracker.deletedAt !== null) {
      throw new DataError('not-found', `Tracker ${id} does not exist`);
    }
    return tracker;
  }

  private async requireCommittedTracker(id: string): Promise<Tracker> {
    const tracker = await this.requireTracker(id);
    if (tracker.currentVersion === 0) {
      throw new DataError(
        'invalid',
        `Tracker ${tracker.name} has no committed Version to log against`,
      );
    }
    return tracker;
  }
}
