import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, type ComponentType } from '@angular/cdk/portal';
import { inject, Injector, Service } from '@angular/core';

export interface PopoverConfig {
  /** The element the popover is positioned against. */
  readonly origin: HTMLElement;
  /** Inputs set on the opened component — it stays presentation-only, injecting nothing. */
  readonly inputs?: Readonly<Record<string, unknown>>;
  readonly ariaLabel?: string;
  /**
   * The opener's injector. Without it the component resolves from the root, which cannot
   * see anything a lazy route provides — a feature's own translations, for one.
   */
  readonly injector?: Injector;
}

export interface PopoverHandle<C> {
  readonly component: C;
  readonly closed: Promise<void>;
  close(): void;
}

/**
 * Owns positioning and stacking for every positioned layer in the app. `DialogService`
 * and popover-style UI (Calendar's quick-create) go through here rather than reaching
 * for `cdk/overlay` directly, so there is one place that decides how layers stack.
 */
@Service()
export class OverlayService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  openPopover<C>(component: ComponentType<C>, config: PopoverConfig): PopoverHandle<C> {
    const overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(config.origin)
        .withFlexibleDimensions(false)
        .withPush(true)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
          { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
        ]),
    });

    const componentRef = overlayRef.attach(
      new ComponentPortal(component, null, config.injector ?? this.injector),
    );
    for (const [name, value] of Object.entries(config.inputs ?? {})) {
      componentRef.setInput(name, value);
    }
    if (config.ariaLabel !== undefined) {
      overlayRef.hostElement.setAttribute('aria-label', config.ariaLabel);
    }

    const closed = new Promise<void>((resolve) => {
      const dispose = () => {
        resolve();
        subscriptions.forEach((subscription) => subscription.unsubscribe());
      };
      const subscriptions = [
        overlayRef.backdropClick().subscribe(() => this.dispose(overlayRef, dispose)),
        overlayRef.keydownEvents().subscribe((event) => {
          if (event.key === 'Escape') {
            this.dispose(overlayRef, dispose);
          }
        }),
        overlayRef.detachments().subscribe(dispose),
      ];
    });

    return {
      component: componentRef.instance,
      closed,
      close: () => this.dispose(overlayRef),
    };
  }

  private dispose(overlayRef: OverlayRef, onDisposed?: () => void): void {
    if (overlayRef.hasAttached()) {
      overlayRef.detach();
    }
    overlayRef.dispose();
    onDisposed?.();
  }
}
