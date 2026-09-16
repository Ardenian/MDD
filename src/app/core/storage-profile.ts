/**
 * Names where the app's data lives and whether it syncs (ADR 0009). v1 ships exactly
 * one, Offline; the point of the concept is that a second one is a new adapter set
 * behind the same bootstrap switch, not a rearchitecture.
 */
export interface StorageProfile {
  readonly id: string;
  readonly labelKey: string;
}

export const OFFLINE_PROFILE: StorageProfile = {
  id: 'offline',
  labelKey: 'settings.storageProfile.offline',
};

export const STORAGE_PROFILES: readonly StorageProfile[] = [OFFLINE_PROFILE];

/** An unknown or unset id falls back to Offline rather than failing bootstrap. */
export function resolveStorageProfile(activeProfileId: string | undefined): StorageProfile {
  return STORAGE_PROFILES.find((profile) => profile.id === activeProfileId) ?? OFFLINE_PROFILE;
}
