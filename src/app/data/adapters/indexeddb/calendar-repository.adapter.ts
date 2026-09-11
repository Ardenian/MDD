import { Injectable, inject } from '@angular/core';
import type { Calendar } from '../../model/calendar';
import { IDENTITY_CONTEXT } from '../../ports/identity-context';
import type { CalendarRepository } from '../../ports/calendar-repository';
import { stampNew } from '../../util/aggregate';
import { STORE } from './database';
import { getAllRecords, putRecord } from './store.util';

@Injectable()
export class CalendarRepositoryIndexedDbAdapter implements CalendarRepository {
  private readonly identityContext = inject(IDENTITY_CONTEXT);

  async get(): Promise<Calendar | null> {
    const [calendar] = await getAllRecords<Calendar>(STORE.calendar);
    return calendar ?? null;
  }

  async ensureExists(): Promise<Calendar> {
    const existing = await this.get();
    if (existing) {
      return existing;
    }

    const calendar: Calendar = {
      ...stampNew(this.identityContext.current()),
      name: 'Calendar',
    };
    return putRecord(STORE.calendar, calendar);
  }
}
