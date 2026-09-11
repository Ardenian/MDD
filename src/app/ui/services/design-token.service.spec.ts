import { TestBed } from '@angular/core/testing';
import { DesignTokenService } from './design-token.service';
import { DESIGN_TOKENS } from '../tokens.generated';

describe('DesignTokenService', () => {
  afterEach(() => {
    for (const name of Object.keys(DESIGN_TOKENS)) {
      document.documentElement.style.removeProperty(name);
    }
  });

  it('applies every generated token as a custom property on the document root', () => {
    const service = TestBed.inject(DesignTokenService);

    service.apply();

    for (const [name, value] of Object.entries(DESIGN_TOKENS)) {
      expect(document.documentElement.style.getPropertyValue(name).trim()).toBe(value);
    }
  });

  it('is idempotent — applying twice leaves the same values in place', () => {
    const service = TestBed.inject(DesignTokenService);

    service.apply();
    service.apply();

    for (const [name, value] of Object.entries(DESIGN_TOKENS)) {
      expect(document.documentElement.style.getPropertyValue(name).trim()).toBe(value);
    }
  });
});
