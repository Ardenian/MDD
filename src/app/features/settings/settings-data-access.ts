import { computed, inject, resource, Service } from '@angular/core';
import type { AppSettings, SettingsPatch } from '../../data/model/settings';
import type { RecordCounts } from '../../data/model/export-bundle';
import { MAINTENANCE_PORT } from '../../data/ports/maintenance-port';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';

/**
 * Stateless DataAccess (ADR 0008) over this feature's two ports. The form's own values
 * are the page's state, not this facade's — everything here is the persisted truth.
 */
@Service()
export class SettingsDataAccess {
  private readonly settings = inject(SETTINGS_REPOSITORY);
  private readonly maintenance = inject(MAINTENANCE_PORT);

  private readonly stored = resource<AppSettings | null, void>({
    loader: () => this.settings.get(),
    defaultValue: null,
  });

  readonly saved = computed(() => this.stored.value());
  readonly isLoading = computed(() => this.stored.isLoading());

  async save(patch: SettingsPatch): Promise<void> {
    await this.settings.save(patch);
    this.stored.reload();
  }

  /**
   * Read on demand rather than held as a signal: the counts exist to make one
   * destructive confirmation concrete, so they must be current at the moment it opens.
   */
  counts(): Promise<RecordCounts> {
    return this.maintenance.counts();
  }

  /** Drops every store and re-seeds the single implicit Calendar (ADR 0009). */
  async clearAll(): Promise<void> {
    await this.maintenance.clearAll();
    this.stored.reload();
  }
}
