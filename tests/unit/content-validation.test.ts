import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { loadAndValidateContent, validateContent } from '../../scripts/validate-content.mjs';
import { planImport } from '../../scripts/import-content.mjs';
import { planSecurityRules } from '../../scripts/plan-security-rules.mjs';

const root = process.cwd();

describe('demo place content', () => {
  it('has valid, paired, four-category demo records', async () => {
    const { places, contents } = await loadAndValidateContent(root);
    expect(places).toHaveLength(4);
    expect(contents).toHaveLength(4);
    expect(new Set(places.map((place: { category: string }) => place.category))).toEqual(new Set(['scenic', 'restaurant', 'culture', 'camping']));
    expect(places.every((place: { status: string; coverFileId: string | null }) => place.status === 'draft' && place.coverFileId === null)).toBe(true);
  });

  it('rejects duplicate IDs, orphan details, invalid coordinates and unsourced content', () => {
    const badPlace = { placeId: 'bad', category: 'wrong', latitude: 99, longitude: 1, coordinateSystem: 'WGS84', sources: [], verifiedAt: 'not-a-date', status: 'published', coverFileId: null };
    expect(validateContent([badPlace, badPlace], [{ placeId: 'orphan', sections: [], updatedAt: 'never' }]).join('\n')).toMatch(/duplicate|category|coordinateSystem|latitude|longitude|sources|coverFileId|orphan/);
  });

  it('rejects unverified dynamic facts and invalid image IDs', () => {
    const place = { placeId: 'dynamic', name: 'name', aliases: [], category: 'scenic', district: 'district', address: 'address', intro: 'intro', tags: [], latitude: 30, longitude: 111, coordinateSystem: 'GCJ-02', sources: [{ title: 'official', url: 'https://example.test', licenseNote: 'self-authored' }], verifiedAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z', status: 'draft', coverFileId: 'https://wrong', openNotice: '需预约' };
    const detail = { placeId: 'dynamic', sections: [{ type: 'image', fileId: 'wrong' }], updatedAt: '2026-09-04T00:00:00.000Z' };
    expect(validateContent([place], [detail]).join('\n')).toMatch(/coverFileId|unverified dynamic|sections/);
  });

  it('plans a no-write development dry-run and blocks real writes without an adapter', async () => {
    await expect(planImport({ root, args: ['--target', 'development', '--dry-run'] })).resolves.toMatchObject({ mode: 'dry-run', places: expect.any(Array) });
    await expect(planImport({ root, args: ['--target', 'production', '--dry-run'] })).rejects.toThrow(/development/);
    await expect(planImport({ root, args: ['--target', 'development', '--apply'] })).resolves.toMatchObject({ mode: 'apply-blocked' });
  });

  it('keeps seed data as JSON rather than frontend literals', async () => {
    const raw = await readFile('content/places.seed.json', 'utf8');
    expect(raw).toContain('demo-three-gorges-dam');
  });

  it('generates one deployable deny-all CloudBase operation per collection', async () => {
    const operations = await planSecurityRules({ root, envId: 'yichang-dev' });
    expect(operations).toHaveLength(12);
    expect(operations.every((operation: { Action: string; Param: { AclTag: string; Rule: string } }) => operation.Action === 'ModifySafeRule' && operation.Param.AclTag === 'CUSTOM' && operation.Param.Rule === '{"read":false,"write":false}')).toBe(true);
  });
});
