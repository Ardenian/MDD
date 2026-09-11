import { Injectable, inject } from '@angular/core';
import type { Uuid } from '../../model/common';
import { dataError } from '../../model/data-error';
import type { Preset, PresetInput, PresetPatch } from '../../model/preset';
import { IDENTITY_CONTEXT } from '../../ports/identity-context';
import type { PresetRepository } from '../../ports/preset-repository';
import { TRACKER_REPOSITORY } from '../../ports/tracker-repository';
import { stampNew, stampUpdate } from '../../util/aggregate';
import { STORE } from './database';
import { deleteRecord, getAllByIndex, getRecord, putRecord } from './store.util';

@Injectable()
export class PresetRepositoryIndexedDbAdapter implements PresetRepository {
  private readonly identityContext = inject(IDENTITY_CONTEXT);
  private readonly trackerRepository = inject(TRACKER_REPOSITORY);

  async listByTracker(trackerId: Uuid): Promise<readonly Preset[]> {
    const presets = await getAllByIndex<Preset>(STORE.presets, 'byTracker', trackerId);
    return presets.filter((preset) => preset.deletedAt === null);
  }

  async get(id: Uuid): Promise<Preset | null> {
    const preset = await getRecord<Preset>(STORE.presets, id);
    return preset && preset.deletedAt === null ? preset : null;
  }

  async create(input: PresetInput): Promise<Preset> {
    const tracker = await this.trackerRepository.get(input.trackerId);
    if (!tracker || tracker.currentVersion === 0) {
      throw dataError('invalid-input', `Tracker ${input.trackerId} has no committed Version yet`);
    }

    const preset: Preset = {
      ...stampNew(this.identityContext.current()),
      trackerId: input.trackerId,
      trackerVersion: tracker.currentVersion,
      name: input.name,
      values: input.values,
      children: input.children,
    };

    return putRecord(STORE.presets, preset);
  }

  async update(id: Uuid, patch: PresetPatch): Promise<Preset> {
    const preset = await this.getOrThrow(id);
    const updated: Preset = stampUpdate({
      ...preset,
      name: patch.name ?? preset.name,
      values: patch.values ?? preset.values,
      children: patch.children ?? preset.children,
    });
    return putRecord(STORE.presets, updated);
  }

  async delete(id: Uuid): Promise<void> {
    await this.getOrThrow(id);
    await deleteRecord(STORE.presets, id);
  }

  private async getOrThrow(id: Uuid): Promise<Preset> {
    const preset = await this.get(id);
    if (!preset) {
      throw dataError('not-found', `Preset ${id} not found`);
    }
    return preset;
  }
}
