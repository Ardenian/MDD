import { inject, Service } from '@angular/core';
import { Store } from '@ngrx/store';
import { identityFeature } from './state/identity/identity.feature';

/**
 * Adapters read ownerId/userId from here when stamping records (ADR 0003).
 * Backed by the app-wide store internally (ADR 0010); adapters stay unaware
 * of that and just call the signals.
 */
@Service()
export class IdentityContext {
  private readonly store = inject(Store);

  readonly ownerId = this.store.selectSignal(identityFeature.selectOwnerId);
  readonly userId = this.store.selectSignal(identityFeature.selectUserId);
}
