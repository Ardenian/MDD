import type { Uuid } from '../model/common';
import { dataError } from '../model/data-error';
import type { Identity } from '../model/identity';
import type { Preset, PresetInput, PresetPatch } from '../model/preset';
import type { PresetRepository } from '../ports/preset-repository';
import type { TrackerRepository } from '../ports/tracker-repository';
import { stampNew, stampUpdate } from '../util/aggregate';

/** In-memory double satisfying the same contract as the IndexedDB adapter. */
export class FakePresetRepository implements PresetRepository {
  private readonly presets = new Map<Uuid, Preset>();

  constructor(
    private readonly trackerRepository: TrackerRepository,
    private readonly identity: Identity = { ownerId: 'dev', userId: 'dev' },
  ) {}

  async listByTracker(trackerId: Uuid): Promise<readonly Preset[]> {
    return [...this.presets.values()].filter(
      (preset) => preset.trackerId === trackerId && preset.deletedAt === null,
    );
  }

  async get(id: Uuid): Promise<Preset | null> {
    const preset = this.presets.get(id);
    return preset && preset.deletedAt === null ? preset : null;
  }

  async create(input: PresetInput): Promise<Preset> {
    const tracker = await this.trackerRepository.get(input.trackerId);
    if (!tracker || tracker.currentVersion === 0) {
      throw dataError('invalid-input', `Tracker ${input.trackerId} has no committed Version yet`);
    }

    const preset: Preset = {
      ...stampNew(this.identity),
      trackerId: input.trackerId,
      trackerVersion: tracker.currentVersion,
      name: input.name,
      values: input.values,
      children: input.children,
    };
    this.presets.set(preset.id, preset);
    return preset;
  }

  async update(id: Uuid, patch: PresetPatch): Promise<Preset> {
    const preset = this.getOrThrow(id);
    const updated = stampUpdate({
      ...preset,
      name: patch.name ?? preset.name,
      values: patch.values ?? preset.values,
      children: patch.children ?? preset.children,
    });
    this.presets.set(id, updated);
    return updated;
  }

  async delete(id: Uuid): Promise<void> {
    this.getOrThrow(id);
    this.presets.delete(id);
  }

  /** Test-only reset, used by `FakeMaintenancePort`. */
  clear(): void {
    this.presets.clear();
  }

  private getOrThrow(id: Uuid): Preset {
    const preset = this.presets.get(id);
    if (!preset) {
      throw dataError('not-found', `Preset ${id} not found`);
    }
    return preset;
  }
}
