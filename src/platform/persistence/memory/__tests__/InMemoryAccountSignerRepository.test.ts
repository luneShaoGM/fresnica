import {runAccountSignerRepositoryContract} from '../../__tests__/repositoryContract';
import {InMemoryAccountSignerRepository} from '../InMemoryAccountSignerRepository';

describe('InMemoryAccountSignerRepository', () => {
  runAccountSignerRepositoryContract(
    () => new InMemoryAccountSignerRepository(),
  );
});
