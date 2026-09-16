import { OFFLINE_PROFILE, resolveStorageProfile, STORAGE_PROFILES } from './storage-profile';

describe('resolveStorageProfile', () => {
  it('resolves the active profile by id', () => {
    expect(resolveStorageProfile('offline')).toBe(OFFLINE_PROFILE);
  });

  it('falls back to Offline when nothing has been chosen', () => {
    expect(resolveStorageProfile(undefined)).toBe(OFFLINE_PROFILE);
  });

  it('falls back to Offline for an id this build does not know', () => {
    expect(resolveStorageProfile('some-future-cloud-profile')).toBe(OFFLINE_PROFILE);
  });

  it('ships exactly one profile in v1', () => {
    expect(STORAGE_PROFILES).toEqual([OFFLINE_PROFILE]);
  });
});
