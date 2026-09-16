import { Dialog } from '@angular/cdk/dialog';
import { ApplicationRef, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';

@Component({
  template: `<button type="button" data-testid="inside">{{ label() }}</button>`,
})
class ProbeDialog {
  readonly label = input('Probe');
}

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [Dialog] });
    service = TestBed.inject(DialogService);
  });

  afterEach(() => {
    service.close();
  });

  it('opens one dialog and reports it as open', () => {
    const handle = service.open(ProbeDialog);

    expect(handle).not.toBeNull();
    expect(service.isOpen()).toBe(true);
  });

  it('refuses a second dialog while one is open', () => {
    service.open(ProbeDialog);

    expect(service.open(ProbeDialog)).toBeNull();
    expect(TestBed.inject(Dialog).openDialogs).toHaveLength(1);
  });

  it('accepts a new dialog once the first has closed', async () => {
    const first = service.open(ProbeDialog);
    first?.close();
    await first?.closed;

    expect(service.isOpen()).toBe(false);
    expect(service.open(ProbeDialog)).not.toBeNull();
  });

  it('passes inputs to the opened component, which injects nothing', async () => {
    const handle = service.open(ProbeDialog, { inputs: { label: 'Confirm deletion' } });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(handle?.component?.label()).toBe('Confirm deletion');
  });

  it('resolves the close result to the caller', async () => {
    const handle = service.open<ProbeDialog, string>(ProbeDialog);

    handle?.close('confirmed');

    await expect(handle?.closed).resolves.toBe('confirmed');
  });

  it('honours disableClose when Escape is pressed', async () => {
    const handle = service.open(ProbeDialog, { disableClose: true });
    await TestBed.inject(ApplicationRef).whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.isOpen()).toBe(true);
    handle?.close();
  });

  it('restores focus to the element that opened it', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const handle = service.open(ProbeDialog);
    await TestBed.inject(ApplicationRef).whenStable();
    handle?.close();
    await handle?.closed;
    await TestBed.inject(ApplicationRef).whenStable();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
