import { createInMemoryDataLayer } from './in-memory-data-layer';
import { describeDataPortContract } from './port-contract.suite';

describeDataPortContract('IndexedDB adapter (in-memory engine)', () => createInMemoryDataLayer());
