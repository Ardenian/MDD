import { type FieldDef, fieldsEqual } from '../../model/field-def';
import type { TimeMode, Tracker, TrackerCreateInput, TrackerMetaInput } from '../../model/tracker';
import { type TrackerVersion, trackerVersionKey } from '../../model/tracker-version';
import type { TrackerRepository } from '../../ports/tracker-repository';
import type { IdbEngine } from './idb-engine';
import { stampCreate, stampUpdate, type StampContext } from './record-meta';
import { byCreation, liveOnly, requireLive } from './records';

export class IndexedDbTrackerRepository implements TrackerRepository {
  constructor(
    private readonly engine: IdbEngine,
    private readonly context: StampContext,
  ) {}

  async list(): Promise<readonly Tracker[]> {
    const trackers = await this.engine.getAll<Tracker>('trackers');
    return liveOnly(trackers).sort(byCreation);
  }

  async get(id: string): Promise<Tracker | undefined> {
    return this.engine.get<Tracker>('trackers', id);
  }

  async create(input: TrackerCreateInput): Promise<Tracker> {
    const fields = input.fields ?? [];
    const tracker = stampCreate(
      {
        name: input.name,
        defaultTimeMode: input.defaultTimeMode,
        currentVersion: 0,
        archived: false,
        draftFields: fields,
      },
      this.context,
    );
    await this.engine.put('trackers', tracker.id, tracker);
    return fields.length === 0 ? tracker : this.mintVersion(tracker, fields);
  }

  async saveDraft(id: string, fields: readonly FieldDef[]): Promise<Tracker> {
    const tracker = await this.require(id);
    return this.write(stampUpdate(tracker, { draftFields: fields }, this.context));
  }

  async commitDraft(id: string): Promise<Tracker> {
    const tracker = await this.require(id);
    const current =
      tracker.currentVersion > 0
        ? await this.getVersion(tracker.id, tracker.currentVersion)
        : undefined;

    if (current === undefined) {
      return tracker.draftFields.length === 0 ? tracker : this.mintVersion(tracker, tracker.draftFields);
    }
    return fieldsEqual(current.fields, tracker.draftFields)
      ? tracker
      : this.mintVersion(tracker, tracker.draftFields);
  }

  async updateMeta(id: string, input: TrackerMetaInput): Promise<Tracker> {
    const tracker = await this.require(id);
    const changes: { name?: string; defaultTimeMode?: TimeMode } = {};
    if (input.name !== undefined) {
      changes.name = input.name;
    }
    if (input.defaultTimeMode !== undefined) {
      changes.defaultTimeMode = input.defaultTimeMode;
    }
    return this.write(stampUpdate(tracker, changes, this.context));
  }

  async archive(id: string): Promise<Tracker> {
    return this.setArchived(id, true);
  }

  async unarchive(id: string): Promise<Tracker> {
    return this.setArchived(id, false);
  }

  async getVersion(trackerId: string, version: number): Promise<TrackerVersion | undefined> {
    return this.engine.get<TrackerVersion>('trackerVersions', trackerVersionKey(trackerId, version));
  }

  private async setArchived(id: string, archived: boolean): Promise<Tracker> {
    const tracker = await this.require(id);
    return this.write(stampUpdate(tracker, { archived }, this.context));
  }

  private async mintVersion(tracker: Tracker, fields: readonly FieldDef[]): Promise<Tracker> {
    const version = stampCreate(
      { trackerId: tracker.id, version: tracker.currentVersion + 1, fields },
      this.context,
    );
    await this.engine.put(
      'trackerVersions',
      trackerVersionKey(version.trackerId, version.version),
      version,
    );
    return this.write(
      stampUpdate(tracker, { currentVersion: version.version, draftFields: fields }, this.context),
    );
  }

  private async write(tracker: Tracker): Promise<Tracker> {
    await this.engine.put('trackers', tracker.id, tracker);
    return tracker;
  }

  private async require(id: string): Promise<Tracker> {
    return requireLive(await this.get(id), 'Tracker', id);
  }
}
