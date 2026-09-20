import { Injectable, computed, inject, Injector, resource, type Signal } from '@angular/core';
import { canAddChild } from '../../data/model/expansion-depth';
import { DataError } from '../../data/model/data-error';
import type { FieldDef, ReferenceFieldDef } from '../../data/model/field-def';
import { DEFAULT_SETTINGS } from '../../data/model/settings';
import { type CurrentSchema, treeFromStored } from '../../data/model/value-tree';
import type { Preset, PresetInput } from '../../data/model/preset';
import type { Tracker, TrackerCreateInput, TrackerMetaInput } from '../../data/model/tracker';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { createPresetNode, type PresetFormNode, toPresetInput } from './preset-form';

export interface TrackerListRow {
  readonly id: string;
  readonly name: string;
  readonly currentVersion: number;
  readonly fieldCount: number;
  readonly entryCount: number;
  readonly presetCount: number;
  readonly archived: boolean;
}

/** Everything the designer needs for one Tracker, bound to the caller's selection. */
export interface TrackerDesignerView {
  readonly tracker: Signal<Tracker | undefined>;
  readonly committedFields: Signal<readonly FieldDef[]>;
  readonly presets: Signal<readonly Preset[]>;
  readonly isLoading: Signal<boolean>;
  reload(): void;
}

/** A Preset opened for editing, always against the Tracker's *current* Version. */
export interface PresetDraft {
  /** `null` until the Preset is first saved. */
  readonly presetId: string | null;
  readonly trackerId: string;
  readonly name: string;
  readonly root: PresetFormNode;
  /** Read fresh when the editor opens, like the Entry form does (settings/SPEC.md). */
  readonly expansionDepthCap: number;
}

/**
 * A stateless DataAccess (ADR 0008): every signal here is the result of a read, and the
 * facade owns no writable state. Which Tracker the designer is on is the *caller's*
 * state — it comes in as a `Signal` to `designerFor()` rather than being stored here,
 * which is what keeps this a DataAccess instead of a Store.
 */
@Injectable()
export class TrackersDataAccess {
  private readonly trackers = inject(TRACKER_REPOSITORY);
  private readonly presets = inject(PRESET_REPOSITORY);
  private readonly entries = inject(ENTRY_REPOSITORY);
  private readonly settings = inject(SETTINGS_REPOSITORY);
  private readonly injector = inject(Injector);

  private readonly overview = resource({
    loader: async () => {
      const [trackers, entryCounts, presetCounts] = await Promise.all([
        this.trackers.list(),
        this.entries.countsByTracker(),
        this.presets.countsByTracker(),
      ]);
      return trackers.map((tracker): TrackerListRow => ({
        id: tracker.id,
        name: tracker.name,
        currentVersion: tracker.currentVersion,
        fieldCount: tracker.draftFields.length,
        entryCount: entryCounts.get(tracker.id) ?? 0,
        presetCount: presetCounts.get(tracker.id) ?? 0,
        archived: tracker.archived,
      }));
    },
    defaultValue: [],
  });

  readonly active = computed(() => this.overview.value().filter((row) => !row.archived));
  readonly archived = computed(() => this.overview.value().filter((row) => row.archived));
  readonly isLoading = computed(() => this.overview.isLoading());

  /** Call from an injection context (a component field initializer). */
  designerFor(trackerId: Signal<string | null>): TrackerDesignerView {
    const tracker = resource({
      injector: this.injector,
      params: () => trackerId(),
      loader: ({ params }) =>
        params === null ? Promise.resolve(undefined) : this.trackers.get(params),
    });

    const committed = resource({
      injector: this.injector,
      params: () => {
        const current = tracker.value();
        return current === undefined || current.currentVersion === 0
          ? null
          : { trackerId: current.id, version: current.currentVersion };
      },
      loader: ({ params }) =>
        params === null
          ? Promise.resolve(undefined)
          : this.trackers.getVersion(params.trackerId, params.version),
    });

    const presets = resource({
      injector: this.injector,
      params: () => trackerId(),
      loader: ({ params }) =>
        params === null ? Promise.resolve([]) : this.presets.listByTracker(params),
      defaultValue: [],
    });

    return {
      tracker: computed(() => tracker.value()),
      committedFields: computed(() => committed.value()?.fields ?? []),
      presets: computed(() => presets.value()),
      isLoading: computed(
        () => tracker.isLoading() || committed.isLoading() || presets.isLoading(),
      ),
      reload: () => {
        tracker.reload();
        committed.reload();
        presets.reload();
        this.overview.reload();
      },
    };
  }

  async createTracker(input: TrackerCreateInput): Promise<Tracker> {
    const tracker = await this.trackers.create(input);
    this.overview.reload();
    return tracker;
  }

  async saveDraft(id: string, fields: readonly FieldDef[]): Promise<Tracker> {
    return this.trackers.saveDraft(id, fields);
  }

  async commitDraft(id: string): Promise<Tracker> {
    const tracker = await this.trackers.commitDraft(id);
    this.overview.reload();
    return tracker;
  }

  async updateMeta(id: string, input: TrackerMetaInput): Promise<Tracker> {
    const tracker = await this.trackers.updateMeta(id, input);
    this.overview.reload();
    return tracker;
  }

  async setArchived(id: string, archived: boolean): Promise<Tracker> {
    const tracker = archived ? await this.trackers.archive(id) : await this.trackers.unarchive(id);
    this.overview.reload();
    return tracker;
  }

  async savePreset(id: string | null, input: PresetInput): Promise<Preset> {
    const preset =
      id === null ? await this.presets.create(input) : await this.presets.update(id, input);
    this.overview.reload();
    return preset;
  }

  async deletePreset(id: string): Promise<void> {
    await this.presets.delete(id);
    this.overview.reload();
  }

  /**
   * Opens a Preset — new, or saved and possibly stale — against the Tracker's current
   * Version. A stale Preset's values carry over by Field name and anything the schema no
   * longer has is dropped; saving it is what re-pins it (ADR 0005).
   */
  async openPreset(trackerId: string, presetId: string | null): Promise<PresetDraft> {
    const expansionDepthCap =
      (await this.settings.get()).expansionDepthCap ?? DEFAULT_SETTINGS.expansionDepthCap;
    const make = (parts: Parameters<typeof createPresetNode>[1]) =>
      createPresetNode(crypto.randomUUID(), parts);

    if (presetId === null) {
      const schema = await this.currentSchema(trackerId);
      return {
        presetId: null,
        trackerId,
        name: '',
        root: make({ ...schema, fieldName: null, stored: [], children: [] }),
        expansionDepthCap,
      };
    }

    const preset = await this.presets.get(presetId);
    if (preset === undefined || preset.deletedAt !== null) {
      throw new DataError('not-found', `Preset ${presetId} does not exist`);
    }
    const root = await treeFromStored<PresetFormNode>(
      preset,
      expansionDepthCap,
      (id) => this.currentSchema(id),
      make,
    );
    return { presetId, trackerId, name: preset.name, root, expansionDepthCap };
  }

  /** A filled child snapshots its own Tracker's current Version, exactly as a child Entry would. */
  async newPresetChild(
    field: ReferenceFieldDef,
    parentDepth: number,
    cap: number,
  ): Promise<PresetFormNode> {
    if (!canAddChild(parentDepth, cap)) {
      throw new DataError('invalid', 'The expansion-depth cap is reached');
    }
    const schema = await this.currentSchema(field.targetTrackerId);
    return createPresetNode(crypto.randomUUID(), {
      ...schema,
      fieldName: field.name,
      stored: [],
      children: [],
    });
  }

  async savePresetDraft(draft: {
    presetId: string | null;
    trackerId: string;
    name: string;
    root: PresetFormNode;
  }): Promise<Preset> {
    return this.savePreset(draft.presetId, toPresetInput(draft.trackerId, draft.name, draft.root));
  }

  private async currentSchema(trackerId: string): Promise<CurrentSchema> {
    const tracker = await this.trackers.get(trackerId);
    if (tracker === undefined || tracker.deletedAt !== null) {
      throw new DataError('not-found', `Tracker ${trackerId} does not exist`);
    }
    if (tracker.currentVersion === 0) {
      throw new DataError('invalid', `Tracker ${tracker.name} has no committed Version yet`);
    }
    const version = await this.trackers.getVersion(tracker.id, tracker.currentVersion);
    return {
      trackerId: tracker.id,
      trackerVersion: tracker.currentVersion,
      fields: version?.fields ?? [],
    };
  }
}
