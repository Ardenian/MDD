import { type EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { DesignTokenService } from '../services/design-token.service';

/** Applies design tokens before the app renders (ADR 0007). */
export function provideDesignTokens(): EnvironmentProviders {
  return provideAppInitializer(() => {
    inject(DesignTokenService).apply();
  });
}
