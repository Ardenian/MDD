import { Service, inject, type ElementRef } from '@angular/core';
import { FocusMonitor, type FocusOrigin } from '@angular/cdk/a11y';
import type { Observable } from 'rxjs';

/**
 * Thin wrapper on `cdk/a11y`'s `FocusMonitor` (`ui/SPEC.md`) — focus-origin-aware
 * styling and programmatic focus beyond what `DialogService` already covers (e.g.
 * Calendar's focus-cell keyboard navigation). Wrapped (rather than features injecting
 * `FocusMonitor` directly) so the "only a feature's top-level component injects a `ui/`
 * service" boundary (ADR 0002) actually applies to this.
 */
@Service()
export class FocusService {
  private readonly focusMonitor = inject(FocusMonitor);

  monitor(element: HTMLElement | ElementRef<HTMLElement>): Observable<FocusOrigin> {
    return this.focusMonitor.monitor(element);
  }

  stopMonitoring(element: HTMLElement | ElementRef<HTMLElement>): void {
    this.focusMonitor.stopMonitoring(element);
  }

  focusVia(element: HTMLElement | ElementRef<HTMLElement>, origin: FocusOrigin, options?: FocusOptions): void {
    this.focusMonitor.focusVia(element, origin, options);
  }
}
