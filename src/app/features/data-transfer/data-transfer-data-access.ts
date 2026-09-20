import { Injectable, computed, inject, resource } from '@angular/core';
import type { ExportBundle, RecordCounts } from '../../data/model/export-bundle';
import { MAINTENANCE_PORT } from '../../data/ports/maintenance-port';

/**
 * Stateless DataAccess (ADR 0008) over `MaintenancePort`. The selected file and whatever
 * the user has typed are the page's state; nothing here outlives a call.
 */
@Injectable()
export class DataTransferDataAccess {
  private readonly maintenance = inject(MAINTENANCE_PORT);

  private readonly counts = resource<RecordCounts | null, void>({
    loader: () => this.maintenance.counts(),
    defaultValue: null,
  });

  /** What an import is about to discard — shown before the replace is confirmed. */
  readonly recordCounts = computed(() => this.counts.value());
  readonly isLoading = computed(() => this.counts.isLoading());

  exportAll(): Promise<ExportBundle> {
    return this.maintenance.exportAll();
  }

  /** A full replace: the port re-seeds the single implicit Calendar, as `clearAll()` does. */
  async importAll(bundle: ExportBundle): Promise<void> {
    await this.maintenance.importAll(bundle);
    this.counts.reload();
  }

  reloadCounts(): void {
    this.counts.reload();
  }
}
