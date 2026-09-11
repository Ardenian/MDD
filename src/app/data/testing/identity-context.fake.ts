import type { Identity } from '../model/identity';
import type { IdentityContext } from '../ports/identity-context';

export class FakeIdentityContext implements IdentityContext {
  constructor(private readonly identity: Identity = { ownerId: 'dev', userId: 'dev' }) {}

  current(): Identity {
    return this.identity;
  }
}
