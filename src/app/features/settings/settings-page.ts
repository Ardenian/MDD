import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The Settings feature's top-level component — per ADR 0002 the only place in this
 * feature allowed to inject a facade or a `ui/` service.
 */
@Component({
  selector: 'app-settings-page',
  imports: [TranslatePipe],
  template: ` <h1 data-testid="page-title">{{ 'app.nav.settings' | translate }}</h1> `,
})
export class SettingsPage {}
