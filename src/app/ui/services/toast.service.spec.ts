import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

class RecordingAnnouncer {
  readonly announced: { message: string; politeness: string }[] = [];
  private release: (() => void) | null = null;

  announce(message: string, politeness: string): Promise<void> {
    this.announced.push({ message, politeness });
    return new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  /** Lets the in-flight announcement finish so the next one may start. */
  finish(): void {
    const release = this.release;
    this.release = null;
    release?.();
  }
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ToastService', () => {
  let announcer: RecordingAnnouncer;
  let service: ToastService;

  beforeEach(() => {
    announcer = new RecordingAnnouncer();
    TestBed.configureTestingModule({
      providers: [{ provide: LiveAnnouncer, useValue: announcer }],
    });
    service = TestBed.inject(ToastService);
  });

  it('exposes each message for rendering, in order', () => {
    service.show('Saved');
    service.error('Could not save');

    expect(service.toasts()).toEqual([
      { id: expect.any(String), message: 'Saved', tone: 'info' },
      { id: expect.any(String), message: 'Could not save', tone: 'error' },
    ]);
  });

  it('announces errors assertively and everything else politely', async () => {
    service.error('Could not save');
    await Promise.resolve();

    expect(announcer.announced).toEqual([{ message: 'Could not save', politeness: 'assertive' }]);
  });

  it('does not drop a message raised while another is being announced', async () => {
    service.show('First');
    service.show('Second');
    await Promise.resolve();

    expect(announcer.announced).toEqual([{ message: 'First', politeness: 'polite' }]);

    announcer.finish();
    await flushMicrotasks();

    expect(announcer.announced.map((entry) => entry.message)).toEqual(['First', 'Second']);
  });

  it('keeps announcing after one announcement fails', async () => {
    const failing = {
      announce: vi
        .fn()
        .mockRejectedValueOnce(new Error('no live region'))
        .mockResolvedValue(undefined),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: LiveAnnouncer, useValue: failing }] });
    const resilient = TestBed.inject(ToastService);

    resilient.show('First');
    resilient.show('Second');
    await resilient.settled();

    expect(failing.announce).toHaveBeenCalledTimes(2);
  });

  it('dismisses one message without touching the rest', () => {
    const first = service.show('First');
    service.show('Second');

    service.dismiss(first);

    expect(service.toasts().map((toast) => toast.message)).toEqual(['Second']);
  });
});
