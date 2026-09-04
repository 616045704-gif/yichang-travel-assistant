import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('database client access baseline', () => {
  it('denies client reads and writes for every declared collection', async () => {
    const rules = JSON.parse(await readFile('database/security-rules.json', 'utf8')) as { default: { read: boolean; write: boolean }; collections: Record<string, { read: boolean; write: boolean }> };
    expect(rules.default).toEqual({ read: false, write: false });
    expect(Object.keys(rules.collections)).toHaveLength(12);
    expect(Object.values(rules.collections).every(rule => rule.read === false && rule.write === false)).toBe(true);
  });
});
