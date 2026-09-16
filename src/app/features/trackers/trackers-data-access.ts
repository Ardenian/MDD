import { computed, inject, Injector, resource, Service, type Signal } from '@angular/core';
import type { FieldDef } from '../../data/model/field-def';
import type { Preset, PresetInput } from '../../data/model/preset';
import type { Tracker, TrackerCreateInput, TrackerMetaInput } from '../../data/model/tracker';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';

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

/**
 * A stateless DataAccess (ADR 0008): every signal here is the result of a read, and the
 * facade owns no writable state. Which Tracker the designer is on is the *caller's*
 * state — it comes in as a `Signal` to `designerFor()` rather than being stored here,
 * which is what keeps this a DataAccess instead of a Store.
 */
@Service()
export class TrackersDataAccess {
  private readonly trackers = inject(TRACKER_REPOSITORY);
  private readonly presets = inject(PRESET_REPOSITORY);
  private readonly entries = inject(ENTRY_REPOSITORY);
  private readonly injector = inject(Injector);

  private readonly overview = resource({
    loader: async () => {
      const [trackers, entryCounts, presetCounts] = await Promise.all([
        this.trackers.list(),
        this.entries.countsByTracker(),
        this.presets.countsByTracker(),
      ]);
      return trackers.map(
        (tracker): TrackerListRow => ({
          id: tracker.id,
          name: tracker.name,
          currentVersion: tracker.currentVersion,
          fieldCount: tracker.draftFields.length,
          entryCount: entryCounts.get(tracker.id) ?? 0,
          presetCount: presetCounts.get(tracker.id) ?? 0,
          archived: tracker.archived,
        }),
      );
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
      loader: ({ params }) => (params === null ? Promise.resolve(undefined) : this.trackers.get(params)),
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
        params === null ? Promise.resolve(undefined) : this.trackers.getVersion(params.trackerId, params.version),
    });

    const presets = resource({
      injector: this.injector,
      params: () => trackerId(),
      loader: ({ params }) => (params === null ? Promise.resolve([]) : this.presets.listByTracker(params)),
      defaultValue: [],
    });

    return {
      tracker: computed(() => tracker.value()),
      committedFields: computed(() => committed.value()?.fields ?? []),
      presets: computed(() => presets.value()),
      isLoading: computed(() => tracker.isLoading() || committed.isLoading() || presets.isLoading()),
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
    const preset = id === null ? await this.presets.create(input) : await this.presets.update(id, input);
    this.overview.reload();
    return preset;
  }

  async deletePreset(id: string): Promise<void> {
    await this.presets.delete(id);
    this.overview.reload();
  }

  reload(): void {
    this.overview.reload();
  }
}
