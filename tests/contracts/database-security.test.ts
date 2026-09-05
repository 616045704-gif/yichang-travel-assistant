import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('database client access baseline', () => {
  it('denies client reads and writes for every declared collection', async () => {
    const rules = JSON.parse(await readFile('database/security-rules.json', 'utf8')) as { rules: Array<{ collection: string; aclTag: string; rule: { read: boolean; write: boolean } }> };
    expect(rules.rules).toHaveLength(12);
    expect(rules.rules.every(entry => entry.aclTag === 'CUSTOM' && entry.rule.read === false && entry.rule.write === false)).toBe(true);
    for (const collection of ['ai_sessions', 'ai_messages', 'trip_requests', 'usage_counters']) {
      expect(rules.rules.find(entry => entry.collection === collection)).toMatchObject({
        aclTag: 'CUSTOM', rule: { read: false, write: false },
      });
    }
  });

  it('declares deterministic owner history indexes for both AI record collections', async () => {
    const manifest = JSON.parse(await readFile('database/indexes.json', 'utf8')) as {
      indexes: Array<{ collection: string; name: string; fields: Array<[string, string]> }>;
    };
    for (const collection of ['ai_messages', 'trip_requests']) {
      expect(manifest.indexes.find(index => index.collection === collection && index.name === 'owner_created')).toEqual({
        collection,
        name: 'owner_created',
        fields: [['ownerId', 'asc'], ['createdAt', 'desc'], ['_id', 'asc']],
      });
    }
  });
});
