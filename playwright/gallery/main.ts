import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  createEnvironmentInjector,
  type EnvironmentInjector,
  provideZonelessChangeDetection,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { FALLBACK_LOCALE } from '../../src/app/core/i18n/supported-locale';
import { StaticCommonTranslateLoader } from '../../src/app/core/i18n/static-translate-loader';
import { DesignTokenService } from '../../src/app/ui/services/design-token.service';
import type { Scenario } from './scenario';

/** What a test asks the page to render. */
interface MountRequest {
  /** `<module path>#<export name>`, e.g. `…/results-table.scenario.ts#sorted`. */
  readonly scenario: string;
  /** Overrides merged over the scenario's own inputs. */
  readonly inputs?: Readonly<Record<string, unknown>>;
}

declare global {
  interface Window {
    mount(request: MountRequest): Promise<void>;
    unmount(): Promise<void>;
    /** Every scenario the harness can render, for diagnosing a bad id. */
    scenarioIds(): Promise<readonly string[]>;
  }
}

/**
 * Vite discovers every scenario in the repo — the same mechanism Playwright's own
 * React and Vue gallery examples use (ADR 0014).
 */
const modules = import.meta.glob<Record<string, unknown>>('../../src/**/*.scenario.ts');

async function scenarioIds(): Promise<readonly string[]> {
  const ids: string[] = [];
  for (const [path, load] of Object.entries(modules)) {
    const module = await load();
    for (const name of Object.keys(module)) {
      ids.push(`${path}#${name}`);
    }
  }
  return ids.sort();
}

async function resolve(id: string): Promise<Scenario> {
  const [path, exportName] = id.split('#');
  const entry = Object.entries(modules).find(([candidate]) => candidate.endsWith(path));
  if (entry === undefined) {
    throw new Error(
      `No scenario module matching "${path}". Known: ${(await scenarioIds()).join(', ')}`,
    );
  }
  const module = await entry[1]();
  const found = module[exportName];
  if (found === undefined) {
    throw new Error(`Scenario module "${path}" has no export "${exportName}".`);
  }
  return found as Scenario;
}

async function bootstrap(): Promise<void> {
  const application = await createApplication({
    providers: [
      provideZonelessChangeDetection(),
      // The real translations, so a scenario renders the words the user sees rather
      // than raw keys. A feature's own strings come from its scenario's providers.
      ...provideTranslateService({
        loader: provideTranslateLoader(StaticCommonTranslateLoader),
        fallbackLang: FALLBACK_LOCALE,
      }),
    ],
  });
  application.injector.get(DesignTokenService).apply();

  const host = document.querySelector('#mount-root');
  if (host === null) {
    throw new Error('The gallery page is missing its #mount-root element.');
  }

  let mounted: ComponentRef<unknown> | null = null;
  let scenarioInjector: EnvironmentInjector | null = null;

  window.mount = async ({ scenario: id, inputs }: MountRequest) => {
    await window.unmount();
    const definition = await resolve(id);

    // A fresh injector per scenario, so one scenario's fakes never leak into the next.
    scenarioInjector = createEnvironmentInjector(
      [...(definition.providers ?? [])],
      application.injector,
    );
    mounted = createComponent(definition.component, {
      environmentInjector: scenarioInjector,
      hostElement: host,
    });
    for (const [name, value] of Object.entries({ ...definition.inputs, ...inputs })) {
      mounted.setInput(name, value);
    }

    application.injector.get(ApplicationRef).attachView(mounted.hostView);
    await application.injector.get(ApplicationRef).whenStable();
  };

  window.unmount = async () => {
    mounted?.destroy();
    mounted = null;
    scenarioInjector?.destroy();
    scenarioInjector = null;
    host.replaceChildren();
  };

  window.scenarioIds = scenarioIds;
  document.body.dataset['galleryReady'] = 'true';
}

void bootstrap();
