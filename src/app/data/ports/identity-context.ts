import { InjectionToken } from '@angular/core';
import type { Identity } from '../model/identity';

/**
 * Raw, storage-shaped port: adapters read this to stamp `ownerId`/`userId` on every
 * write (ADR 0003). `core/` provides the concrete implementation (hardcoded `dev`/`dev`
 * in v1, real auth later) — the interface lives here so adapters can depend on it
 * without depending on `core/`.
 */
export interface IdentityContext {
  current(): Identity;
}

export const IDENTITY_CONTEXT = new InjectionToken<IdentityContext>('IdentityContext');
