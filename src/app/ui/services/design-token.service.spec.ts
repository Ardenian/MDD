import { TestBed } from '@angular/core/testing';
import { DESIGN_TOKENS } from '../tokens.generated';
import { DesignTokenService } from './design-token.service';

describe('DesignTokenService', () => {
  function styleOf(name: string): string {
    return document.documentElement.style.getPropertyValue(`--${name}`);
  }

  afterEach(() => {
    for (const name of Object.keys(DESIGN_TOKENS)) {
      document.documentElement.style.removeProperty(`--${name}`);
    }
  });

  it('applies every generated token as a custom property', () => {
    TestBed.inject(DesignTokenService).apply();

    for (const [name, value] of Object.entries(DESIGN_TOKENS)) {
      expect(styleOf(name)).toBe(value);
    }
  });

  it('is idempotent', () => {
    const service = TestBed.inject(DesignTokenService);

    service.apply();
    service.apply();

    expect(styleOf('color-accent')).toBe(DESIGN_TOKENS['color-accent']);
  });

  it('overwrites a token when a different set is applied', () => {
    const service = TestBed.inject(DesignTokenService);

    service.apply();
    service.apply({ 'color-accent': '#000000' });

    expect(styleOf('color-accent')).toBe('#000000');
    expect(styleOf('color-ink')).toBe(DESIGN_TOKENS['color-ink']);
  });
});
