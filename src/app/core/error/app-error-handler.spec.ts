import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { DataError } from '../../data/model/data-error';
import { ToastService } from '../../ui/services/toast.service';
import { AppErrorHandler } from './app-error-handler';
import { toDataError } from './to-data-error';

describe('toDataError', () => {
  it('passes a DataError through untouched', () => {
    const original = new DataError('not-found', 'Tracker missing');

    expect(toDataError(original)).toBe(original);
  });

  it('wraps an ordinary Error, keeping it as the cause', () => {
    const original = new Error('IDB transaction aborted');
    const normalised = toDataError(original);

    expect(normalised).toBeInstanceOf(DataError);
    expect(normalised.code).toBe('unavailable');
    expect(normalised.message).toBe('IDB transaction aborted');
    expect(normalised.cause).toBe(original);
  });

  it('wraps a thrown non-Error', () => {
    expect(toDataError('something odd').message).toBe('something odd');
  });
});

describe('AppErrorHandler', () => {
  let toasts: { error: ReturnType<typeof vi.fn> };
  let handler: ErrorHandler;

  beforeEach(() => {
    toasts = { error: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: toasts },
        { provide: TranslateService, useValue: { instant: (key: string) => `translated:${key}` } },
        { provide: ErrorHandler, useClass: AppErrorHandler },
      ],
    });
    handler = TestBed.inject(ErrorHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows exactly one toast per error and does not rethrow', () => {
    expect(() => handler.handleError(new DataError('not-found', 'Tracker missing'))).not.toThrow();

    expect(toasts.error).toHaveBeenCalledTimes(1);
    expect(toasts.error).toHaveBeenCalledWith('translated:errors.not-found');
  });

  it('maps an adapter failure to the unavailable message', () => {
    handler.handleError(new Error('IDB transaction aborted'));

    expect(toasts.error).toHaveBeenCalledWith('translated:errors.unavailable');
  });
});
