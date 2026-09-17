import { WriteQueue } from './write-queue';

describe('WriteQueue', () => {
  it('runs work one at a time, in the order it was queued', async () => {
    const queue = new WriteQueue();
    const log: string[] = [];
    const step = (name: string) => async () => {
      log.push(`${name}:start`);
      await Promise.resolve();
      log.push(`${name}:end`);
    };

    await Promise.all([queue.run(step('a')), queue.run(step('b'))]);

    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('hands each caller its own result', async () => {
    const queue = new WriteQueue();

    await expect(
      Promise.all([queue.run(async () => 1), queue.run(async () => 2)]),
    ).resolves.toEqual([1, 2]);
  });

  it('rejects only the failing caller and keeps serving the rest', async () => {
    const queue = new WriteQueue();

    const failing = queue.run(async () => {
      throw new Error('boom');
    });
    const next = queue.run(async () => 'still running');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('still running');
  });
});
