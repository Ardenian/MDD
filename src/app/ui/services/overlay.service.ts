import { Service, inject, type ComponentRef } from '@angular/core';
import { Overlay, type ConnectedPosition, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, type ComponentType } from '@angular/cdk/portal';

export interface OverlayOptions {
  readonly hasBackdrop?: boolean;
}

export interface OverlayHandle<T> {
  readonly overlayRef: OverlayRef;
  readonly componentRef: ComponentRef<T>;
  close(): void;
}

/**
 * Thin wrapper on `cdk/overlay` + `cdk/portal` (`ui/SPEC.md`): owns positioning for
 * every *non-dialog* positioned layer in the app (e.g. Calendar's quick-create popover
 * on an empty grid slot). `DialogService` does **not** sit on top of this — see its own
 * doc comment for why.
 */
@Service()
export class OverlayService {
  private readonly overlay = inject(Overlay);
  private readonly openRefs = new Set<OverlayRef>();

  /** Opens `component` anchored to `origin`, closing itself on a backdrop click. */
  openConnected<T>(
    component: ComponentType<T>,
    origin: HTMLElement,
    positions: readonly ConnectedPosition[],
    options?: OverlayOptions,
  ): OverlayHandle<T> {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(origin)
      .withPositions([...positions])
      .withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: options?.hasBackdrop ?? false,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    const componentRef = overlayRef.attach(new ComponentPortal(component));
    this.openRefs.add(overlayRef);

    const close = (): void => {
      overlayRef.dispose();
      this.openRefs.delete(overlayRef);
    };
    overlayRef.backdropClick().subscribe(close);

    return { overlayRef, componentRef, close };
  }

  /** Closes every overlay this service currently has open. */
  closeAll(): void {
    for (const overlayRef of [...this.openRefs]) {
      overlayRef.dispose();
    }
    this.openRefs.clear();
  }

  get openCount(): number {
    return this.openRefs.size;
  }
}
