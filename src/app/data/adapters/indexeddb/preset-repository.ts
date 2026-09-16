import type { Preset, PresetInput } from '../../model/preset';
import type { Tracker } from '../../model/tracker';
import type { PresetRepository } from '../../ports/preset-repository';
import type { IdbEngine } from './idb-engine';
import { stampCreate, stampSoftDelete, stampUpdate, type StampContext } from './record-meta';
import { byCreation, liveOnly, requireLive } from './records';

export class IndexedDbPresetRepository implements PresetRepository {
  constructor(
    private readonly engine: IdbEngine,
    private readonly context: StampContext,
  ) {}

  async listByTracker(trackerId: string): Promise<readonly Preset[]> {
    const presets = liveOnly(await this.engine.getAll<Preset>('presets'));
    return presets.filter((preset) => preset.trackerId === trackerId).sort(byCreation);
  }

  async countsByTracker(): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    for (const preset of liveOnly(await this.engine.getAll<Preset>('presets'))) {
      counts.set(preset.trackerId, (counts.get(preset.trackerId) ?? 0) + 1);
    }
    return counts;
  }

  async get(id: string): Promise<Preset | undefined> {
    return this.engine.get<Preset>('presets', id);
  }

  async create(input: PresetInput): Promise<Preset> {
    const tracker = await this.requireTracker(input.trackerId);
    const preset = stampCreate(
      {
        trackerId: input.trackerId,
        trackerVersion: tracker.currentVersion,
        name: input.name,
        values: input.values,
        children: input.children,
      },
      this.context,
    );
    await this.engine.put('presets', preset.id, preset);
    return preset;
  }

  /** Saving re-pins to the current Version, which is what clears staleness (ADR 0005). */
  async update(id: string, input: PresetInput): Promise<Preset> {
    const preset = requireLive(await this.get(id), 'Preset', id);
    const tracker = await this.requireTracker(input.trackerId);
    const updated = stampUpdate(
      preset,
      {
        trackerVersion: tracker.currentVersion,
        name: input.name,
        values: input.values,
        children: input.children,
      },
      this.context,
    );
    await this.engine.put('presets', updated.id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const preset = requireLive(await this.get(id), 'Preset', id);
    await this.engine.put('presets', preset.id, stampSoftDelete(preset, this.context));
  }

  private async requireTracker(id: string): Promise<Tracker> {
    return requireLive(await this.engine.get<Tracker>('trackers', id), 'Tracker', id);
  }
}
