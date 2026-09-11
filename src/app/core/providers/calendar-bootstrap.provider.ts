import { type EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { CALENDAR_REPOSITORY } from '../../data/ports/calendar-repository';

/** Ensures exactly one Calendar record exists before the app renders (core/SPEC.md). */
export function provideCalendarBootstrap(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const calendarRepository = inject(CALENDAR_REPOSITORY);
    return calendarRepository.ensureExists();
  });
}
