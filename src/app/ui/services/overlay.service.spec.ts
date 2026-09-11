import { TestBed } from '@angular/core/testing';
import { Overlay } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import { OverlayService } from './overlay.service';

class DummyComponent {}

class FakePositionStrategy {
  withPositions(): this {
    return this;
  }
  withPush(): this {
    return this;
  }
}

class FakeOverlayRef {
  disposed = false;
  private readonly backdropClickSubject = new Subject<MouseEvent>();

  attach(): { instance: unknown } {
    return { instance: {} };
  }

  dispose(): void {
    this.disposed = true;
  }

  backdropClick() {
    return this.backdropClickSubject.asObservable();
  }

  emitBackdropClick(): void {
    this.backdropClickSubject.next(new MouseEvent('click'));
  }
}

class FakeOverlay {
  readonly createdRefs: FakeOverlayRef[] = [];
  readonly scrollStrategies = { reposition: () => ({}) };

  position() {
    return { flexibleConnectedTo: () => new FakePositionStrategy() };
  }

  create(): FakeOverlayRef {
    const ref = new FakeOverlayRef();
    this.createdRefs.push(ref);
    return ref;
  }
}

function setup() {
  const fakeOverlay = new FakeOverlay();
  TestBed.configureTestingModule({
    providers: [{ provide: Overlay, useValue: fakeOverlay }],
  });
  return { fakeOverlay, service: TestBed.inject(OverlayService) };
}

describe('OverlayService', () => {
  it('tracks how many overlays are currently open', () => {
    const { service } = setup();
    expect(service.openCount).toBe(0);

    service.openConnected(DummyComponent, document.createElement('div'), []);
    expect(service.openCount).toBe(1);
  });

  it('disposes and untracks an overlay when its backdrop is clicked', () => {
    const { service, fakeOverlay } = setup();

    service.openConnected(DummyComponent, document.createElement('div'), []);
    const [ref] = fakeOverlay.createdRefs;

    ref.emitBackdropClick();

    expect(ref.disposed).toBe(true);
    expect(service.openCount).toBe(0);
  });

  it('closeAll disposes every tracked overlay', () => {
    const { service, fakeOverlay } = setup();

    service.openConnected(DummyComponent, document.createElement('div'), []);
    service.openConnected(DummyComponent, document.createElement('div'), []);

    service.closeAll();

    expect(fakeOverlay.createdRefs.every((ref) => ref.disposed)).toBe(true);
    expect(service.openCount).toBe(0);
  });

  it('the handle returned by openConnected closes its own overlay', () => {
    const { service, fakeOverlay } = setup();

    const handle = service.openConnected(DummyComponent, document.createElement('div'), []);
    handle.close();

    expect(fakeOverlay.createdRefs[0].disposed).toBe(true);
    expect(service.openCount).toBe(0);
  });
});
