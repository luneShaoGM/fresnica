import {runAccountSignerRepositoryContract} from '../../repositoryContract';
import {InMemoryAccountSignerRepository} from '../InMemoryAccountSignerRepository';

describe('InMemoryAccountSignerRepository', () => {
  runAccountSignerRepositoryContract(
    () => new InMemoryAccountSignerRepository(),
  );
});
