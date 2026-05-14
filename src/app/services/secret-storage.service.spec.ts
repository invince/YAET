import {SecretStorageService} from './secret-storage.service';
import {Secret, Secrets} from '../domain/Secret';

function createSecret(id: string, name: string): Secret {
  const s = new Secret();
  s.id = id;
  s.name = name;
  return s;
}

describe('SecretStorageService', () => {
  let service: SecretStorageService;
  let secrets: Secrets;

  beforeEach(() => {
    service = new SecretStorageService();
    secrets = new Secrets();
    secrets.secrets = [
      createSecret('s1', 'API Key'),
      createSecret('s2', 'Password'),
      createSecret('s3', 'Token'),
    ];
    service.data = secrets;
  });

  it('should store and retrieve data', () => {
    expect(service.data).toBe(secrets);
    expect(service.data.secrets.length).toBe(3);
  });

  describe('dataCopy', () => {
    it('should return a different object reference', () => {
      const copy = service.dataCopy;
      expect(copy).not.toBe(secrets);
    });

    it('should contain the same secret items', () => {
      const copy = service.dataCopy;
      expect(copy.secrets.length).toBe(3);
      expect(copy.secrets[0].id).toBe('s1');
      expect(copy.secrets[1].id).toBe('s2');
    });

    it('should create a shallow copy so modifying copy does not affect original', () => {
      const copy = service.dataCopy;
      copy.secrets.push(createSecret('s4', 'New'));
      expect(service.data.secrets.length).toBe(3);
    });

    it('should handle undefined data gracefully', () => {
      service = new SecretStorageService();
      const copy = service.dataCopy;
      expect(copy.secrets).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should find a secret by id', () => {
      const found = service.findById('s2');
      expect(found).toBeTruthy();
      expect(found!.name).toBe('Password');
    });

    it('should return undefined when id does not exist', () => {
      const found = service.findById('nonexistent');
      expect(found).toBeUndefined();
    });

    it('should match using loose equality', () => {
      const found = service.findById('s2' as any);
      expect(found).toBeTruthy();
    });
  });

  describe('filter', () => {
    it('should filter secrets by predicate', () => {
      const result = service.filter(s => s.name.includes('e'));
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('s1');
      expect(result[1].id).toBe('s3');
    });

    it('should return empty array when no match', () => {
      const result = service.filter(s => s.name === 'Nope');
      expect(result).toEqual([]);
    });

    it('should handle undefined secrets gracefully', () => {
      const emptySecrets = new Secrets();
      emptySecrets.secrets = undefined as any;
      service.data = emptySecrets;
      const result = service.filter(s => true);
      expect(result).toBeUndefined();
    });
  });
});
