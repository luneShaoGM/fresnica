import Realm from 'realm';

export function createRealmRecordId(): string {
  return new Realm.BSON.ObjectId().toHexString();
}
