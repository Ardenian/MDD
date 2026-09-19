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
import { SCENARIO_MODULES } from './scenarios.generated';

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
    scenarioIds(): readonly string[];
  }
}

/**
 * Every scenario in the repo, from the generated registry.
 *
 * ADR 0014 calls for Vite's `import.meta.glob` here. It does not work under this
 * toolchain: the Angular builder bundles with esbuild and never applies Vite's glob
 * transform, so the call reaches the browser unexpanded and matches nothing.
 * `scripts/generate-scenarios.mjs` writes the same mapping from the files on disk, and
 * `pnpm run gallery` runs it before serving, so scenarios are still discovered rather
 * than listed by hand.
 */
const modules = SCENARIO_MODULES;

function scenarioIds(): readonly string[] {
  return Object.entries(modules)
    .flatMap(([path, module]) => Object.keys(module).map((name) => `${path}#${name}`))
    .sort();
}

function resolve(id: string): Scenario {
  const [path, exportName] = id.split('#');
  const entry = Object.entries(modules).find(([candidate]) => candidate.endsWith(path));
  if (entry === undefined) {
    throw new Error(`No scenario module matching "${path}". Known: ${scenarioIds().join(', ')}`);
  }
  const found = entry[1][exportName];
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
    const definition = resolve(id);

    // A fresh injector per scenario, so one scenario's fakes never leak into the next.
    scenarioInjector = createEnvironmentInjector(
      [...(definition.providers ?? [])],
      application.injector,
    );
    // Seed before the component exists: it reads its data on construction.
    const seeded = (await definition.setup?.(scenarioInjector)) ?? {};

    mounted = createComponent(definition.component, {
      environmentInjector: scenarioInjector,
      hostElement: host,
    });
    for (const [name, value] of Object.entries({ ...definition.inputs, ...seeded, ...inputs })) {
      mounted.setInput(name, value);
    }

    // Close the loop the real parent closes: an output the scenario binds comes straight
    // back in as an input.
    for (const [output, toInputs] of Object.entries(definition.bindings ?? {})) {
      const emitter = (mounted.instance as Record<string, unknown>)[output] as {
        subscribe(next: (value: never) => void): unknown;
      };
      emitter.subscribe((value) => {
        for (const [name, next] of Object.entries(toInputs(value))) {
          mounted?.setInput(name, next);
        }
      });
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
