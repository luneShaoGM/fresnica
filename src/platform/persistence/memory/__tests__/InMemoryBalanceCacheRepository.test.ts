import { runBalanceCacheRepositoryContract } from '../../__tests__/balanceCacheRepositoryContract';
import { InMemoryBalanceCacheRepository } from '../InMemoryBalanceCacheRepository';
runBalanceCacheRepositoryContract(() => new InMemoryBalanceCacheRepository());
