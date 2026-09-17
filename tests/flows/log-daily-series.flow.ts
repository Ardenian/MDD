import type { Page } from '@playwright/test';
import { logEntry } from './log-entry.flow';

export interface DailySeriesOptions {
  readonly trackerId: string;
  readonly field: string;
  /** One value per day, starting `startDaysAgo` days back and moving forward a day each. */
  readonly values: readonly number[];
  readonly startDaysAgo: number;
}

/**
 * Logs one Day-bucketed Entry per day, so a scan has a Series with enough Buckets to say
 * anything about. Flows are the one place test code composes Page Object Models across
 * features (ADR 0013).
 */
export async function logDailySeries(page: Page, options: DailySeriesOptions): Promise<void> {
  for (const [index, value] of options.values.entries()) {
    await logEntry(page, {
      trackerId: options.trackerId,
      at: dayOffset(options.startDaysAgo - index),
      mode: 'dayBucketed',
      values: [{ field: options.field, fill: String(value) }],
    });
  }
}

/** Noon, so a timezone offset can never push the Entry onto the neighbouring day. */
function dayOffset(daysAgo: number): string {
  const today = new Date();
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysAgo,
    12,
  ).toISOString();
}
