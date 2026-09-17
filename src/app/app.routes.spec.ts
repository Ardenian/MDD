import { routes } from './app.routes';

describe('routes', () => {
  const featurePaths = ['calendar', 'trackers', 'correlation', 'settings', 'data-transfer'];

  it('defaults to the Calendar', () => {
    expect(routes[0]).toMatchObject({ path: '', redirectTo: 'calendar' });
  });

  it('declares every v1 feature route', () => {
    const paths = routes.map((route) => route.path);

    for (const path of featurePaths) {
      expect(paths).toContain(path);
    }
  });

  it('loads every feature lazily, with no eager component reference', () => {
    for (const path of featurePaths) {
      const route = routes.find((candidate) => candidate.path === path);

      expect(route?.loadComponent ?? route?.loadChildren).toBeInstanceOf(Function);
      expect(route?.component).toBeUndefined();
      expect(route?.children).toBeUndefined();
    }
  });

  it('opens the Entry form lazily in the modal outlet', () => {
    const entry = routes.find((route) => route.path === 'entry');

    expect(entry).toMatchObject({ outlet: 'modal' });
    expect(entry?.loadChildren).toBeInstanceOf(Function);
  });

  it('sends an unknown path to the Calendar rather than a blank screen', () => {
    expect(routes.at(-1)).toMatchObject({ path: '**', redirectTo: 'calendar' });
  });
});
