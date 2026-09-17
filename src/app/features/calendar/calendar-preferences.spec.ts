import {
  DEFAULT_CALENDAR_PREFERENCES,
  forKnownTrackers,
  parsePreferences,
  serializePreferences,
} from './calendar-preferences';

describe('calendar preferences', () => {
  it('round-trips through storage', () => {
    const preferences = {
      view: 'week',
      hiddenTrackerIds: ['workout'],
      showChildren: true,
    } as const;

    expect(parsePreferences(serializePreferences(preferences))).toEqual(preferences);
  });

  it('falls back to defaults for nothing, garbage, or the wrong shape', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_CALENDAR_PREFERENCES);
    expect(parsePreferences('{not json')).toEqual(DEFAULT_CALENDAR_PREFERENCES);
    expect(parsePreferences('42')).toEqual(DEFAULT_CALENDAR_PREFERENCES);
    expect(
      parsePreferences('{"view":"month","hiddenTrackerIds":[1,"a"],"showChildren":"yes"}'),
    ).toEqual({
      view: 'day',
      hiddenTrackerIds: ['a'],
      showChildren: false,
    });
  });

  it('ignores a stored Tracker id that no longer exists', () => {
    const stored = { ...DEFAULT_CALENDAR_PREFERENCES, hiddenTrackerIds: ['workout', 'deleted'] };

    expect(forKnownTrackers(stored, new Set(['workout', 'sleep'])).hiddenTrackerIds).toEqual([
      'workout',
    ]);
  });
});
