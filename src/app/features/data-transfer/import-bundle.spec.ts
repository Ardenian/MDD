import { EXPORT_FORMAT_VERSION, type ExportBundle } from '../../data/model/export-bundle';
import { exportFileName, parseBundle } from './import-bundle';

function bundle(overrides: Partial<ExportBundle> = {}): ExportBundle {
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: '2026-09-17T10:00:00.000Z',
    trackers: [],
    trackerVersions: [],
    entries: [],
    presets: [],
    tags: [],
    settings: { expansionDepthCap: 5 },
    ...overrides,
  };
}

describe('parseBundle', () => {
  it('accepts a bundle of the current format version', () => {
    const result = parseBundle(JSON.stringify(bundle()));

    expect(result).toEqual({ ok: true, bundle: bundle() });
  });

  it('rejects a file that is not JSON at all', () => {
    expect(parseBundle('not a bundle')).toEqual({ ok: false, problem: 'not-json' });
  });

  it('rejects JSON that is not an object', () => {
    expect(parseBundle('[1, 2, 3]')).toEqual({ ok: false, problem: 'not-a-bundle' });
    expect(parseBundle('null')).toEqual({ ok: false, problem: 'not-a-bundle' });
  });

  it('rejects an object with no format version to check', () => {
    expect(parseBundle(JSON.stringify({ trackers: [] }))).toEqual({
      ok: false,
      problem: 'not-a-bundle',
    });
  });

  it('rejects another version and reports which one it found', () => {
    expect(parseBundle(JSON.stringify(bundle({ formatVersion: 0 })))).toEqual({
      ok: false,
      problem: 'format-version',
      foundVersion: 0,
    });
  });

  it('rejects a newer version just as firmly as an older one', () => {
    const newer = EXPORT_FORMAT_VERSION + 1;

    expect(parseBundle(JSON.stringify(bundle({ formatVersion: newer })))).toEqual({
      ok: false,
      problem: 'format-version',
      foundVersion: newer,
    });
  });

  it('checks the version before the shape, so an old file is named as old', () => {
    // A bundle from an earlier format is allowed to look nothing like this one.
    const old = JSON.stringify({ formatVersion: 0, records: [] });

    expect(parseBundle(old)).toEqual({ ok: false, problem: 'format-version', foundVersion: 0 });
  });

  it.each(['trackers', 'trackerVersions', 'entries', 'presets', 'tags'] as const)(
    'rejects a bundle whose %s is missing',
    (aggregate) => {
      const incomplete = { ...bundle() } as Record<string, unknown>;
      delete incomplete[aggregate];

      expect(parseBundle(JSON.stringify(incomplete))).toEqual({
        ok: false,
        problem: 'not-a-bundle',
      });
    },
  );

  it('rejects a bundle whose Settings are missing', () => {
    const incomplete = { ...bundle() } as Record<string, unknown>;
    delete incomplete['settings'];

    expect(parseBundle(JSON.stringify(incomplete))).toEqual({ ok: false, problem: 'not-a-bundle' });
  });

  it('keeps the records it was given, untouched', () => {
    const withData = bundle({
      trackers: [{ id: 'tracker-1' }] as unknown as ExportBundle['trackers'],
    });

    const result = parseBundle(JSON.stringify(withData));

    expect(result).toEqual({ ok: true, bundle: withData });
  });
});

describe('exportFileName', () => {
  it('names the file after the local day it was exported on', () => {
    const noon = new Date(2026, 8, 17, 12, 0).toISOString();

    expect(exportFileName(noon)).toBe('diary-calendar-2026-09-17.json');
  });

  it('pads single-digit months and days', () => {
    const early = new Date(2026, 0, 5, 9, 30).toISOString();

    expect(exportFileName(early)).toBe('diary-calendar-2026-01-05.json');
  });
});
