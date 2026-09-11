import { Injectable, InjectionToken, inject } from '@angular/core';
import type { Uuid } from '../../data/model/common';
import { dataError } from '../../data/model/data-error';
import type { Entry, ListEntriesOptions, Placement } from '../../data/model/entry';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { TAG_REPOSITORY } from '../../data/ports/tag-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import {
  buildEntryFormModel,
  formModelToSnapshot,
  isEntryFormValid,
  missingRequiredFields,
  type FieldInputModel,
} from './entry-form';

export interface EntryFormContext {
  readonly trackerId: Uuid;
  readonly trackerVersion: number;
  readonly model: readonly FieldInputModel[];
}

export interface CreateEntryInput {
  readonly trackerId: Uuid;
  readonly parentEntryId: Uuid | null;
  readonly placement: Placement;
  readonly model: readonly FieldInputModel[];
  readonly tags: readonly string[];
}

export interface UpdateEntryInput {
  readonly placement?: Placement;
  readonly model?: readonly FieldInputModel[];
  readonly tags?: readonly string[];
}

/**
 * Feature-local facade (ADR 0002): the Entry form's only way to reach
 * `EntryRepository`/`TagRepository`/`TrackerRepository`/`PresetRepository`, shaped for
 * schema-driven form building and validated create/update. Only the Entries feature's
 * top-level component injects this.
 */
export interface EntriesFacade {
  listByRange(start: string, end: string, options?: ListEntriesOptions): Promise<readonly Entry[]>;
  /** Builds a fresh form against the Tracker's *current* Version, optionally pre-filled
   *  from a Preset. */
  loadFormForNewEntry(trackerId: Uuid, presetId?: Uuid): Promise<EntryFormContext>;
  /** Builds a form against an existing Entry's *pinned* Version, pre-filled from its
   *  own Snapshot. */
  loadFormForExistingEntry(entryId: Uuid): Promise<EntryFormContext | null>;
  /** Throws `DataError('invalid-input')` (cause = the missing required Fields) without
   *  creating anything if the form is invalid. */
  create(input: CreateEntryInput): Promise<Entry>;
  update(id: Uuid, input: UpdateEntryInput): Promise<Entry>;
  softDelete(id: Uuid): Promise<void>;
  suggestTags(prefix: string): Promise<readonly string[]>;
}

export const ENTRIES_FACADE = new InjectionToken<EntriesFacade>('EntriesFacade');

@Injectable()
export class EntriesFacadeService implements EntriesFacade {
  private readonly entryRepository = inject(ENTRY_REPOSITORY);
  private readonly tagRepository = inject(TAG_REPOSITORY);
  private readonly trackerRepository = inject(TRACKER_REPOSITORY);
  private readonly presetRepository = inject(PRESET_REPOSITORY);

  listByRange(start: string, end: string, options?: ListEntriesOptions): Promise<readonly Entry[]> {
    return this.entryRepository.listByRange(start, end, options);
  }

  async loadFormForNewEntry(trackerId: Uuid, presetId?: Uuid): Promise<EntryFormContext> {
    const tracker = await this.trackerRepository.get(trackerId);
    if (!tracker || tracker.currentVersion === 0) {
      throw dataError('invalid-input', `Tracker ${trackerId} has no committed Version yet`);
    }

    const version = await this.trackerRepository.getVersion(trackerId, tracker.currentVersion);
    const preset = presetId ? await this.presetRepository.get(presetId) : null;

    return {
      trackerId,
      trackerVersion: tracker.currentVersion,
      model: buildEntryFormModel(version?.fields ?? [], preset?.values ?? []),
    };
  }

  async loadFormForExistingEntry(entryId: Uuid): Promise<EntryFormContext | null> {
    const entry = await this.entryRepository.get(entryId);
    if (!entry) {
      return null;
    }

    const version = await this.trackerRepository.getVersion(entry.trackerId, entry.trackerVersion);

    return {
      trackerId: entry.trackerId,
      trackerVersion: entry.trackerVersion,
      model: buildEntryFormModel(version?.fields ?? [], entry.snapshot),
    };
  }

  async create(input: CreateEntryInput): Promise<Entry> {
    this.assertValid(input.model);
    return this.entryRepository.create({
      trackerId: input.trackerId,
      parentEntryId: input.parentEntryId,
      placement: input.placement,
      snapshot: formModelToSnapshot(input.model),
      tags: input.tags,
    });
  }

  async update(id: Uuid, input: UpdateEntryInput): Promise<Entry> {
    if (input.model) {
      this.assertValid(input.model);
    }
    return this.entryRepository.update(id, {
      placement: input.placement,
      snapshot: input.model ? formModelToSnapshot(input.model) : undefined,
      tags: input.tags,
    });
  }

  softDelete(id: Uuid): Promise<void> {
    return this.entryRepository.softDelete(id);
  }

  suggestTags(prefix: string): Promise<readonly string[]> {
    return this.tagRepository.suggest(prefix);
  }

  private assertValid(model: readonly FieldInputModel[]): void {
    if (!isEntryFormValid(model)) {
      throw dataError('invalid-input', 'Entry form has missing required Fields', missingRequiredFields(model));
    }
  }
}
