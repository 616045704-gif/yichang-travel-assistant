import { describe, expect, it, vi } from 'vitest';
import { createUserRepository } from '../../cloudfunctions/users/repository';

describe('user record repository isolation', () => {
  it('filters every favorite read by its trusted owner and uses fixed opaque document ids', async () => {
    const where = vi.fn(() => ({
      get: async () => ({ data: [{ _id: 'record', placeId: 'place-a', createdAt: '2026-09-04T00:00:00.000Z' }] }),
      limit: () => ({ get: async () => ({ data: [{ _id: 'record', placeId: 'place-a', createdAt: '2026-09-04T00:00:00.000Z' }] }) }),
      orderBy: () => ({ skip: () => ({ limit: () => ({ get: async () => ({ data: [{ _id: 'record', placeId: 'place-a', createdAt: '2026-09-04T00:00:00.000Z' }] }) }) }) }),
    }));
    const doc = vi.fn(() => ({ get: async () => ({ data: { status: 'published' } }), set: vi.fn(), remove: vi.fn() }));
    const database = { command: { in: (values: string[]) => ({ $in: values }) }, collection: () => ({ where, doc }) };
    const repository = createUserRepository(database);
    await repository.listRecords('user-a', 'favorites', null, 20);
    await repository.favoritePlaceIds('user-b', ['place-b']);
    await repository.setFavorite('user-a', 'place-a', true);
    expect(where).toHaveBeenNthCalledWith(1, { ownerId: 'user-a' });
    expect(where).toHaveBeenNthCalledWith(2, { ownerId: 'user-b', placeId: { $in: ['place-b'] } });
    expect(doc).toHaveBeenLastCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(doc).not.toHaveBeenCalledWith(expect.stringContaining('user-a'));
  });
});
