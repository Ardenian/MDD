import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { provideCoreState } from './core/core.providers';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideCoreState(), provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a skip link ahead of the navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="skip-link"]')?.getAttribute('href')).toBe(
      '#main-content',
    );
  });

  it('links to every v1 feature', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const paths = [...compiled.querySelectorAll('[data-testid="app-nav"] a')].map((link) =>
      link.getAttribute('data-testid'),
    );

    expect(paths).toEqual([
      '/calendar',
      '/trackers',
      '/correlation',
      '/settings',
      '/data-transfer',
    ]);
  });
});
