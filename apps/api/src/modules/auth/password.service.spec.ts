import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies the original password', async () => {
    const hash = await service.hash('Sup3rSecret');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Sup3rSecret');
    await expect(service.verify(hash, 'Sup3rSecret')).resolves.toBe(true);
  }, 20_000);

  it('rejects a wrong password', async () => {
    const hash = await service.hash('Sup3rSecret');

    await expect(service.verify(hash, 'sup3rsecret')).resolves.toBe(false);
    await expect(service.verify(hash, '')).resolves.toBe(false);
  }, 20_000);

  it('produces a different hash for the same password (unique salt)', async () => {
    const [first, second] = await Promise.all([service.hash('same'), service.hash('same')]);

    expect(first).not.toBe(second);
  }, 20_000);

  it('treats a malformed stored hash as a failed verification, not an error', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('generates high-entropy, url-safe refresh tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => service.generateRefreshToken()));

    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(43);
    }
  });

  it('hashes refresh tokens deterministically so lookup by digest works', () => {
    const token = service.generateRefreshToken();

    expect(service.hashRefreshToken(token)).toBe(service.hashRefreshToken(token));
    expect(service.hashRefreshToken(token)).toHaveLength(64);
    expect(service.hashRefreshToken(token)).not.toBe(service.hashRefreshToken(`${token}x`));
  });
});
