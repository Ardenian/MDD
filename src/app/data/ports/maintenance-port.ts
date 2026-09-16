import { InjectionToken } from '@angular/core';
import type { Calendar } from '../model/calendar';
import type { ExportBundle, RecordCounts } from '../model/export-bundle';

export interface MaintenancePort {
  /** Empties every store and re-seeds the single implicit Calendar. */
  clearAll(): Promise<void>;
  exportAll(): Promise<ExportBundle>;
  /** Rejects a format-version mismatch outright; otherwise a full replace. */
  importAll(bundle: ExportBundle): Promise<void>;
  /** Backs the confirm-before-destroy displays in Settings and Data Transfer. */
  counts(): Promise<RecordCounts>;
  /** Create-if-absent; called by `core/` at bootstrap. */
  ensureCalendar(): Promise<Calendar>;
}

export const MAINTENANCE_PORT = new InjectionToken<MaintenancePort>('MaintenancePort');
