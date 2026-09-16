import { FocusMonitor, type FocusOrigin, InteractivityChecker } from '@angular/cdk/a11y';
import { inject, Service } from '@angular/core';

/**
 * Focus-origin-aware styling and programmatic focus beyond what `DialogService` already
 * covers — Calendar's roving focus cell is the v1 consumer.
 */
@Service()
export class FocusService {
  private readonly focusMonitor = inject(FocusMonitor);
  private readonly checker = inject(InteractivityChecker);

  focusVia(element: HTMLElement, origin: FocusOrigin = 'program'): void {
    this.focusMonitor.focusVia(element, origin);
  }

  watch(element: HTMLElement) {
    return this.focusMonitor.monitor(element);
  }

  stopWatching(element: HTMLElement): void {
    this.focusMonitor.stopMonitoring(element);
  }

  /** Returns whether anything was focusable to move to. */
  focusFirstTabbable(container: HTMLElement, origin: FocusOrigin = 'program'): boolean {
    const candidate = Array.from(container.querySelectorAll<HTMLElement>('*')).find((element) =>
      this.checker.isTabbable(element),
    );
    if (candidate === undefined) {
      return false;
    }
    this.focusVia(candidate, origin);
    return true;
  }
}
