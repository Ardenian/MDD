import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { Subject } from 'rxjs';
import { DialogService } from './dialog.service';

class DummyComponent {}

class FakeDialogRef<R> {
  private readonly closedSubject = new Subject<R | undefined>();
  readonly closed = this.closedSubject.asObservable();

  close(result?: R): void {
    this.closedSubject.next(result);
    this.closedSubject.complete();
  }
}

class FakeDialog {
  lastConfig: unknown;
  readonly refs: FakeDialogRef<unknown>[] = [];

  open<R>(_component: unknown, config?: unknown): FakeDialogRef<R> {
    this.lastConfig = config;
    const ref = new FakeDialogRef<R>();
    this.refs.push(ref as FakeDialogRef<unknown>);
    return ref;
  }
}

function setup() {
  const fakeDialog = new FakeDialog();
  TestBed.configureTestingModule({
    providers: [{ provide: Dialog, useValue: fakeDialog }],
  });
  return { fakeDialog, service: TestBed.inject(DialogService) };
}

describe('DialogService', () => {
  it('forwards disableClose, ariaLabel, and data, and always sets ariaModal', () => {
    const { service, fakeDialog } = setup();

    service.open(DummyComponent, { data: { id: 1 }, disableClose: true, ariaLabel: 'Confirm' });

    expect(fakeDialog.lastConfig).toMatchObject({
      data: { id: 1 },
      disableClose: true,
      ariaLabel: 'Confirm',
      ariaModal: true,
    });
  });

  it('defaults disableClose to false when not specified', () => {
    const { service, fakeDialog } = setup();
    service.open(DummyComponent);
    expect(fakeDialog.lastConfig).toMatchObject({ disableClose: false });
  });

  it('rejects opening a second dialog while one is already open', () => {
    const { service } = setup();
    service.open(DummyComponent);

    expect(() => service.open(DummyComponent)).toThrow(/already open/);
  });

  it('isOpen reflects the current state and resets once the dialog closes', async () => {
    const { service, fakeDialog } = setup();
    expect(service.isOpen).toBe(false);

    const handle = service.open<string>(DummyComponent);
    expect(service.isOpen).toBe(true);

    fakeDialog.refs[0].close('done');
    await handle.closed;

    expect(service.isOpen).toBe(false);
  });

  it('allows opening a new dialog after the previous one closes', async () => {
    const { service, fakeDialog } = setup();
    const first = service.open(DummyComponent);
    fakeDialog.refs[0].close();
    await first.closed;

    expect(() => service.open(DummyComponent)).not.toThrow();
  });

  it('the closed promise resolves with the result passed to close()', async () => {
    const { service, fakeDialog } = setup();
    const handle = service.open<string>(DummyComponent);

    fakeDialog.refs[0].close('confirmed');

    expect(await handle.closed).toBe('confirmed');
  });
});
