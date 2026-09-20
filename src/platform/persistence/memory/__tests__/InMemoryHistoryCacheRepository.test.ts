import { runHistoryCacheRepositoryContract } from '../../__tests__/historyCacheRepositoryContract';
import { InMemoryHistoryCacheRepository } from '../InMemoryHistoryCacheRepository';

describe('InMemoryHistoryCacheRepository', () => {
  runHistoryCacheRepositoryContract(() => new InMemoryHistoryCacheRepository());
});
