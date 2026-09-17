/**
 * Serialises writes across a whole port set. Every mutating repository call is a
 * read-then-write over separate IndexedDB transactions, so two calls started back to
 * back — a rename followed by a Time-mode change, a Draft edit while a commit is in
 * flight — would otherwise both read before either writes, and one would silently undo
 * the other. Reads are not queued: they never race a read-modify-write.
 *
 * Call `run` only from a public port method. Queued work must never call another queued
 * method on the same set, or it waits on itself forever — share a private helper instead.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
