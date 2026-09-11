import { InjectionToken } from '@angular/core';

/**
 * Raw, storage-shaped port. Only `data/` facades and `core/`'s wiring inject this
 * directly — presentation code never does (ADR 0002).
 */
export interface MaintenancePort {
  /** Empties every object store and leaves exactly one Calendar record. */
  clearAll(): Promise<void>;
}

export const MAINTENANCE_PORT = new InjectionToken<MaintenancePort>('MaintenancePort');
