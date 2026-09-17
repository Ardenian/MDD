import { EXPORT_FORMAT_VERSION, type ExportBundle } from '../../data/model/export-bundle';
import { localDayOf } from '../../data/model/placement';

export type ImportProblem = 'not-json' | 'not-a-bundle' | 'format-version';

export type ParsedBundle =
  | { readonly ok: true; readonly bundle: ExportBundle }
  | { readonly ok: false; readonly problem: ImportProblem; readonly foundVersion?: number };

const AGGREGATES = ['trackers', 'trackerVersions', 'entries', 'presets', 'tags'] as const;

/**
 * Reads a selected file's text, so a file the app cannot use is refused before the
 * confirmation step is ever reached and before anything is touched (ADR 0009).
 */
export function parseBundle(text: string): ParsedBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'not-json' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, problem: 'not-a-bundle' };
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate['formatVersion'] !== 'number') {
    return { ok: false, problem: 'not-a-bundle' };
  }

  // The version is checked before the shape: a bundle from another format is entitled to
  // look nothing like this one, and "exported by a different version" is the useful
  // thing to say about it.
  const foundVersion = candidate['formatVersion'];
  if (foundVersion !== EXPORT_FORMAT_VERSION) {
    return { ok: false, problem: 'format-version', foundVersion };
  }

  const complete =
    AGGREGATES.every((aggregate) => Array.isArray(candidate[aggregate])) &&
    typeof candidate['settings'] === 'object' &&
    candidate['settings'] !== null;

  return complete
    ? { ok: true, bundle: candidate as unknown as ExportBundle }
    : { ok: false, problem: 'not-a-bundle' };
}

export function exportFileName(exportedAt: string): string {
  return `diary-calendar-${localDayOf(new Date(exportedAt).getTime())}.json`;
}
