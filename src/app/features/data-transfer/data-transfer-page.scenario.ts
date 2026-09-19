import { scenario } from '../../../../playwright/gallery/scenario';
import { provideInMemoryPorts } from '../../data/testing/scenario-ports';
import { DataTransferDataAccess } from './data-transfer-data-access';
import { DataTransferPage } from './data-transfer-page';
import { provideDataTransferTranslations } from './i18n/data-transfer-translations';

/**
 * The Data Transfer page against empty storage. Rejecting a file the app cannot read is
 * decided before anything is touched, so it needs the page on screen and nothing else.
 */
export const empty = scenario({
  component: DataTransferPage,
  providers: [
    provideDataTransferTranslations(),
    // Built here rather than in the root injector, so it sees the fakes below.
    DataTransferDataAccess,
    provideInMemoryPorts(),
  ],
});
