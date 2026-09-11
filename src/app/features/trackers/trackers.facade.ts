import { Injectable, InjectionToken, inject } from '@angular/core';
import type { Uuid } from '../../data/model/common';
import { dataError } from '../../data/model/data-error';
import { isPresetStale, type Preset } from '../../data/model/preset';
import type { FieldDef, Tracker, TrackerCreateInput, TrackerMetaPatch } from '../../data/model/tracker';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { analyzeExpansion, validateDraftFields, type ExpansionAnalysis } from './tracker-schema';
import { fieldDefsEqual } from '../../data/util/field-defs-equal';

export interface TrackerSummaryView {
  readonly id: Uuid;
  readonly name: string;
  readonly currentVersion: number;
  readonly fieldCount: number;
  readonly presetCount: number;
  readonly archived: boolean;
}

export interface PresetSummaryView {
  readonly id: Uuid;
  readonly name: string;
  readonly stale: boolean;
}

export interface TrackerDetailView {
  readonly tracker: Tracker;
  /** The current committed Version's Fields, `[]` if nothing has been committed yet. */
  readonly currentFields: readonly FieldDef[];
  readonly isDraftDirty: boolean;
  readonly presets: readonly PresetSummaryView[];
}

/**
 * Feature-local facade (ADR 0002): the Tracker editor's only way to reach
 * `TrackerRepository`/`PresetRepository`, shaped for what the editor actually needs
 * rather than around storage. Only the Trackers feature's top-level component injects
 * this.
 */
export interface TrackersFacade {
  list(): Promise<readonly TrackerSummaryView[]>;
  get(id: Uuid): Promise<TrackerDetailView | null>;
  create(input: TrackerCreateInput): Promise<Tracker>;
  /** Validates the Draft first; throws `DataError('invalid-input')` (cause = the
   *  `FieldValidationError[]`) without saving anything if it's invalid. */
  saveDraft(id: Uuid, fields: readonly FieldDef[]): Promise<Tracker>;
  commitDraft(id: Uuid): Promise<Tracker>;
  discardDraft(id: Uuid): Promise<Tracker>;
  updateMeta(id: Uuid, patch: TrackerMetaPatch): Promise<Tracker>;
  archive(id: Uuid): Promise<Tracker>;
  unarchive(id: Uuid): Promise<Tracker>;
  /** Powers the non-blocking "this can build an infinite form" Draft warning. */
  analyzeDraftExpansion(id: Uuid, fields: readonly FieldDef[], depthCap: number): Promise<ExpansionAnalysis>;
}

export const TRACKERS_FACADE = new InjectionToken<TrackersFacade>('TrackersFacade');

@Injectable()
export class TrackersFacadeService implements TrackersFacade {
  private readonly trackerRepository = inject(TRACKER_REPOSITORY);
  private readonly presetRepository = inject(PRESET_REPOSITORY);

  async list(): Promise<readonly TrackerSummaryView[]> {
    const trackers = await this.trackerRepository.list();
    return Promise.all(trackers.map((tracker) => this.toSummary(tracker)));
  }

  async get(id: Uuid): Promise<TrackerDetailView | null> {
    const tracker = await this.trackerRepository.get(id);
    if (!tracker) {
      return null;
    }

    const [currentFields, presets] = await Promise.all([
      this.currentFieldsFor(tracker),
      this.presetRepository.listByTracker(id),
    ]);

    return {
      tracker,
      currentFields,
      isDraftDirty: tracker.draftFields !== null && !fieldDefsEqual(tracker.draftFields, currentFields),
      presets: presets.map((preset) => this.toPresetSummary(preset, tracker.currentVersion)),
    };
  }

  create(input: TrackerCreateInput): Promise<Tracker> {
    return this.trackerRepository.create(input);
  }

  async saveDraft(id: Uuid, fields: readonly FieldDef[]): Promise<Tracker> {
    const errors = validateDraftFields(fields);
    if (errors.length > 0) {
      throw dataError('invalid-input', 'Draft has validation errors', errors);
    }
    return this.trackerRepository.saveDraft(id, fields);
  }

  commitDraft(id: Uuid): Promise<Tracker> {
    return this.trackerRepository.commitDraft(id);
  }

  discardDraft(id: Uuid): Promise<Tracker> {
    return this.trackerRepository.discardDraft(id);
  }

  updateMeta(id: Uuid, patch: TrackerMetaPatch): Promise<Tracker> {
    return this.trackerRepository.updateMeta(id, patch);
  }

  archive(id: Uuid): Promise<Tracker> {
    return this.trackerRepository.archive(id);
  }

  unarchive(id: Uuid): Promise<Tracker> {
    return this.trackerRepository.unarchive(id);
  }

  async analyzeDraftExpansion(
    id: Uuid,
    fields: readonly FieldDef[],
    depthCap: number,
  ): Promise<ExpansionAnalysis> {
    const trackers = await this.trackerRepository.list();
    const fieldsByTracker = new Map<Uuid, readonly FieldDef[]>(
      await Promise.all(
        trackers.map(async (tracker): Promise<[Uuid, readonly FieldDef[]]> => [
          tracker.id,
          await this.currentFieldsFor(tracker),
        ]),
      ),
    );

    return analyzeExpansion(
      id,
      fields,
      { fieldsFor: (trackerId) => fieldsByTracker.get(trackerId) ?? [] },
      depthCap,
    );
  }

  private async currentFieldsFor(tracker: Tracker): Promise<readonly FieldDef[]> {
    if (tracker.currentVersion === 0) {
      return [];
    }
    const version = await this.trackerRepository.getVersion(tracker.id, tracker.currentVersion);
    return version?.fields ?? [];
  }

  private async toSummary(tracker: Tracker): Promise<TrackerSummaryView> {
    const [currentFields, presets] = await Promise.all([
      this.currentFieldsFor(tracker),
      this.presetRepository.listByTracker(tracker.id),
    ]);

    return {
      id: tracker.id,
      name: tracker.name,
      currentVersion: tracker.currentVersion,
      fieldCount: currentFields.length,
      presetCount: presets.length,
      archived: tracker.archived,
    };
  }

  private toPresetSummary(preset: Preset, currentVersion: number): PresetSummaryView {
    return {
      id: preset.id,
      name: preset.name,
      stale: isPresetStale(preset, currentVersion),
    };
  }
}
