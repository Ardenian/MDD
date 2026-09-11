import { isDeleted, stampNew, stampSoftDelete, stampUpdate } from './aggregate';
import type { Identity } from '../model/identity';

const identity: Identity = { ownerId: 'owner-1', userId: 'user-1' };

describe('stampNew', () => {
  it('assigns a fresh id, timestamps, and revision 1', () => {
    const record = stampNew(identity);

    expect(record.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(record.createdAt).toBe(record.updatedAt);
    expect(record.deletedAt).toBeNull();
    expect(record.revision).toBe(1);
    expect(record.ownerId).toBe('owner-1');
    expect(record.userId).toBe('user-1');
  });

  it('produces a different id on every call', () => {
    expect(stampNew(identity).id).not.toBe(stampNew(identity).id);
  });
});

describe('stampUpdate', () => {
  it('bumps revision and updatedAt while preserving createdAt', () => {
    const original = { ...stampNew(identity) };
    const updated = stampUpdate(original);

    expect(updated.revision).toBe(original.revision + 1);
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.deletedAt).toBeNull();
  });
});

describe('stampSoftDelete', () => {
  it('sets deletedAt, bumps updatedAt/revision, and keeps the row', () => {
    const original = { ...stampNew(identity) };
    const deleted = stampSoftDelete(original);

    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.revision).toBe(original.revision + 1);
    expect(deleted.id).toBe(original.id);
    expect(isDeleted(deleted)).toBe(true);
    expect(isDeleted(original)).toBe(false);
  });
});
