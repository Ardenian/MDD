import { createFeature, createReducer } from '@ngrx/store';

export interface IdentityState {
  ownerId: string;
  userId: string;
}

// Hardcoded in v1 (ADR 0003) — no actions dispatch against this feature yet.
const initialIdentityState: IdentityState = { ownerId: 'dev', userId: 'dev' };

export const identityFeature = createFeature({
  name: 'identity',
  reducer: createReducer(initialIdentityState),
});
