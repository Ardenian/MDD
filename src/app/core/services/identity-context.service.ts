import { Injectable } from '@angular/core';
import type { Identity } from '../../data/model/identity';
import type { IdentityContext } from '../../data/ports/identity-context';

/** Hardcoded to `dev`/`dev` until real authentication exists (core/SPEC.md, ADR 0003). */
@Injectable()
export class DevIdentityContext implements IdentityContext {
  private static readonly IDENTITY: Identity = { ownerId: 'dev', userId: 'dev' };

  current(): Identity {
    return DevIdentityContext.IDENTITY;
  }
}
