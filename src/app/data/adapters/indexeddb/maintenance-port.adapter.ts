import { Injectable, inject } from '@angular/core';
import { CALENDAR_REPOSITORY } from '../../ports/calendar-repository';
import type { MaintenancePort } from '../../ports/maintenance-port';
import { STORE } from './database';
import { clearStore } from './store.util';

const ALL_STORES = Object.values(STORE);

@Injectable()
export class MaintenancePortIndexedDbAdapter implements MaintenancePort {
  private readonly calendarRepository = inject(CALENDAR_REPOSITORY);

  async clearAll(): Promise<void> {
    await Promise.all(ALL_STORES.map((store) => clearStore(store)));
    await this.calendarRepository.ensureExists();
  }
}
