import {
  isLive,
  stampCreate,
  stampSoftDelete,
  stampUpdate,
  type StampContext,
} from './record-meta';

function contextAt(instant: string, id = 'generated-uuid'): StampContext {
  return {
    ownerId: 'dev',
    userId: 'dev',
    now: () => instant,
    newId: () => id,
  };
}

describe('stampCreate', () => {
  it('assigns identity, timestamps and revision 1', () => {
    const record = stampCreate(
      { name: 'Sleep' },
      contextAt('2026-01-01T10:00:00.000Z', 'tracker-1'),
    );

    expect(record).toEqual({
      name: 'Sleep',
      id: 'tracker-1',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
      deletedAt: null,
      revision: 1,
      ownerId: 'dev',
      userId: 'dev',
    });
  });

  it('stamps ownerId and userId from the identity context', () => {
    const record = stampCreate(
      { name: 'Sleep' },
      {
        ownerId: 'owner-9',
        userId: 'user-4',
        now: () => '2026-01-01T10:00:00.000Z',
        newId: () => 'x',
      },
    );

    expect(record.ownerId).toBe('owner-9');
    expect(record.userId).toBe('user-4');
  });
});

describe('stampUpdate', () => {
  const created = stampCreate(
    { name: 'Sleep' },
    contextAt('2026-01-01T10:00:00.000Z', 'tracker-1'),
  );

  it('bumps revision and updatedAt while preserving createdAt and identity', () => {
    const updated = stampUpdate(
      created,
      { name: 'Sleep & Rest' },
      contextAt('2026-02-02T08:30:00.000Z'),
    );

    expect(updated).toEqual({
      ...created,
      name: 'Sleep & Rest',
      updatedAt: '2026-02-02T08:30:00.000Z',
      revision: 2,
    });
  });

  it('bumps revision once per write', () => {
    const once = stampUpdate(created, {}, contextAt('2026-02-02T08:30:00.000Z'));
    const twice = stampUpdate(once, {}, contextAt('2026-02-03T08:30:00.000Z'));

    expect(twice.revision).toBe(3);
  });

  it('never lets a caller overwrite the record invariants', () => {
    const updated = stampUpdate(
      created,
      { id: 'hijacked', revision: 99, createdAt: '1999-01-01T00:00:00.000Z' } as Partial<
        typeof created
      >,
      contextAt('2026-02-02T08:30:00.000Z'),
    );

    expect(updated.id).toBe('tracker-1');
    expect(updated.revision).toBe(2);
    expect(updated.createdAt).toBe('2026-01-01T10:00:00.000Z');
  });
});

describe('stampSoftDelete', () => {
  const created = stampCreate(
    { name: 'Sleep' },
    contextAt('2026-01-01T10:00:00.000Z', 'tracker-1'),
  );

  it('sets deletedAt and bumps the revision', () => {
    const deleted = stampSoftDelete(created, contextAt('2026-03-03T12:00:00.000Z'));

    expect(deleted.deletedAt).toBe('2026-03-03T12:00:00.000Z');
    expect(deleted.updatedAt).toBe('2026-03-03T12:00:00.000Z');
    expect(deleted.revision).toBe(2);
  });

  it('keeps the row readable and its payload intact', () => {
    const deleted = stampSoftDelete(created, contextAt('2026-03-03T12:00:00.000Z'));

    expect(deleted.name).toBe('Sleep');
    expect(deleted.id).toBe('tracker-1');
  });
});

describe('isLive', () => {
  const created = stampCreate({ name: 'Sleep' }, contextAt('2026-01-01T10:00:00.000Z'));

  it('is true for a record that has not been soft-deleted', () => {
    expect(isLive(created)).toBe(true);
  });

  it('is false once deletedAt is set', () => {
    expect(isLive(stampSoftDelete(created, contextAt('2026-03-03T12:00:00.000Z')))).toBe(false);
  });
});
