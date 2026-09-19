import { inject, type Provider, Service } from '@angular/core';
import { createIndexedDbPortSet, type PortSet } from '../data/adapters/indexeddb/adapter-set';
import {
  BrowserIdbEngine,
  IDB_ENGINE,
  type IdbEngine,
} from '../data/adapters/indexeddb/idb-engine';
import { browserStampContext } from '../data/adapters/indexeddb/record-meta';
import { CORRELATION_DATA_SOURCE } from '../data/ports/correlation-data-source';
import { ENTRY_REPOSITORY } from '../data/ports/entry-repository';
import { MAINTENANCE_PORT } from '../data/ports/maintenance-port';
import { PRESET_REPOSITORY } from '../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../data/ports/settings-repository';
import { TAG_REPOSITORY } from '../data/ports/tag-repository';
import { TRACKER_REPOSITORY } from '../data/ports/tracker-repository';
import { IdentityContext } from './identity-context';
import { OFFLINE_PROFILE, resolveStorageProfile, type StorageProfile } from './storage-profile';

type PortSetBuilder = (engine: IdbEngine, identity: IdentityContext) => PortSet;

/**
 * The one switch point. Adding a sync-capable Storage Profile later means adding an
 * entry here and nothing else — no feature changes, since features name facades, and
 * facades name port tokens (ADR 0002, ADR 0009).
 */
const PORT_SET_BUILDERS: Readonly<Record<string, PortSetBuilder>> = {
  [OFFLINE_PROFILE.id]: (engine, identity) =>
    createIndexedDbPortSet(
      engine,
      browserStampContext({ ownerId: identity.ownerId, userId: identity.userId }),
    ),
};

/**
 * Holds the port set the active Storage Profile resolves to. Every port token reads from
 * here, so the whole set swaps together and never half-and-half.
 */
@Service()
export class ActivePortSet {
  private readonly engine = inject(IDB_ENGINE);
  private readonly identity = inject(IdentityContext);

  private profile: StorageProfile = OFFLINE_PROFILE;
  private ports: PortSet | null = null;

  get activeProfile(): StorageProfile {
    return this.profile;
  }

  get(): PortSet {
    this.ports ??= this.build(this.profile);
    return this.ports;
  }

  /**
   * Reads `activeProfileId` with the default set, then binds the set it names. A
   * Profile change only takes effect on the next reload — Angular's DI is wired at
   * bootstrap and the whole adapter set is not hot-swapped (ADR 0009).
   */
  async bootstrap(): Promise<StorageProfile> {
    const settings = await this.get().settings.get();
    const resolved = resolveStorageProfile(settings.activeProfileId);
    if (resolved.id !== this.profile.id) {
      this.profile = resolved;
      this.ports = this.build(resolved);
    }
    return this.profile;
  }

  private build(profile: StorageProfile): PortSet {
    // `resolveStorageProfile` has already mapped an unknown id to Offline, so reaching
    // here with no builder means the Profile registry and the builder registry disagree.
    const builder = PORT_SET_BUILDERS[profile.id];
    if (builder === undefined) {
      throw new Error(`No adapter set is registered for Storage Profile "${profile.id}"`);
    }
    return builder(this.engine, this.identity);
  }
}

export function provideDataAdapters(): Provider[] {
  return [
    { provide: IDB_ENGINE, useFactory: () => new BrowserIdbEngine() },
    { provide: TRACKER_REPOSITORY, useFactory: () => inject(ActivePortSet).get().trackers },
    { provide: ENTRY_REPOSITORY, useFactory: () => inject(ActivePortSet).get().entries },
    { provide: PRESET_REPOSITORY, useFactory: () => inject(ActivePortSet).get().presets },
    { provide: TAG_REPOSITORY, useFactory: () => inject(ActivePortSet).get().tags },
    { provide: SETTINGS_REPOSITORY, useFactory: () => inject(ActivePortSet).get().settings },
    { provide: CORRELATION_DATA_SOURCE, useFactory: () => inject(ActivePortSet).get().correlation },
    { provide: MAINTENANCE_PORT, useFactory: () => inject(ActivePortSet).get().maintenance },
  ];
}
