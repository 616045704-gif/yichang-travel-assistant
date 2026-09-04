import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('database client access baseline', () => {
  it('denies client reads and writes for every declared collection', async () => {
    const rules = JSON.parse(await readFile('database/security-rules.json', 'utf8')) as { rules: Array<{ collection: string; aclTag: string; rule: { read: boolean; write: boolean } }> };
    expect(rules.rules).toHaveLength(12);
    expect(rules.rules.every(entry => entry.aclTag === 'CUSTOM' && entry.rule.read === false && entry.rule.write === false)).toBe(true);
  });
});
