import { ConfigService } from '@nestjs/config';

import { PasswordService } from './password.service';

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    ARGON_MEMORY_COST: 8192,
    ARGON_TIME_COST: 2,
    ARGON_PARALLELISM: 1,
  };
  const values = { ...defaults, ...overrides };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService(makeConfig());
  });

  it('hash produces an Argon2id string (prefix $argon2id$)', async () => {
    const hash = await service.hash('s3cret-pass');
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('hashing the same input produces different outputs (random salt)', async () => {
    const a = await service.hash('same-pass');
    const b = await service.hash('same-pass');
    expect(a).not.toBe(b);
  });

  it('verify returns true for the hash of the original password', async () => {
    const hash = await service.hash('correct-horse-battery-staple');
    await expect(service.verify(hash, 'correct-horse-battery-staple')).resolves.toBe(true);
  });

  it('verify returns false for the wrong password', async () => {
    const hash = await service.hash('right-pass');
    await expect(service.verify(hash, 'wrong-pass')).resolves.toBe(false);
  });

  it('verify returns false (without throwing) for a malformed hash', async () => {
    await expect(service.verify('not-a-valid-hash', 'anything')).resolves.toBe(false);
    await expect(service.verify('', 'anything')).resolves.toBe(false);
  });

  it('respects defaults when ConfigService has no values', async () => {
    const fallback = new PasswordService({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);
    const hash = await fallback.hash('default-cfg');
    await expect(fallback.verify(hash, 'default-cfg')).resolves.toBe(true);
  });
});
