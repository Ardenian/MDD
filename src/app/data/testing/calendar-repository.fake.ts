import type { Calendar } from '../model/calendar';
import type { Identity } from '../model/identity';
import type { CalendarRepository } from '../ports/calendar-repository';
import { stampNew } from '../util/aggregate';

export class FakeCalendarRepository implements CalendarRepository {
  private calendar: Calendar | null = null;

  constructor(private readonly identity: Identity = { ownerId: 'dev', userId: 'dev' }) {}

  async get(): Promise<Calendar | null> {
    return this.calendar;
  }

  async ensureExists(): Promise<Calendar> {
    this.calendar ??= { ...stampNew(this.identity), name: 'Calendar' };
    return this.calendar;
  }

  /** Test-only reset, used by `FakeMaintenancePort`. */
  clear(): void {
    this.calendar = null;
  }
}
