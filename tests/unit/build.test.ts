import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProject } from '../../scripts/build.mjs';
import { checkPackage, validateResources } from '../../scripts/check-package.mjs';
import { verifyDocs } from '../../scripts/verify-docs.mjs';

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'yichang-build-'));
  roots.push(root);
  const files: Record<string, string> = {
    'project.config.json': JSON.stringify({ appid: 'touristappid', miniprogramRoot: 'dist/miniprogram/', cloudfunctionRoot: 'dist/cloudfunctions/' }),
    'miniprogram/app.ts': 'App({});',
    'miniprogram/app.json': JSON.stringify({ pages: ['pages/home/index'] }),
    'miniprogram/app.wxss': 'page { color: #123; }',
    'miniprogram/pages/home/index.ts': 'Page({});',
    'miniprogram/pages/home/index.json': '{}',
    'miniprogram/pages/home/index.wxml': '<view>测试</view>',
    'miniprogram/pages/home/index.wxss': 'view { padding: 8rpx; }',
  };
  for (const [name, text] of Object.entries(files)) await put(root, name, text);
  return root;
}
async function put(root: string, name: string, value: string) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), value);
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe('deployable build boundary', () => {
  it('builds a minimal client without sources or tests', async () => {
    const root = await fixture();
    await buildProject({ root });
    expect(await readFile(path.join(root, 'dist/miniprogram/app.js'), 'utf8')).toContain('App(');
    expect(await readdir(path.join(root, 'dist/miniprogram'))).not.toContain('app.ts');
  });
  it('preserves the imported project directory and IDE preferences across rebuilds', async () => {
    const root = await fixture();
    await put(root, 'dist/project.private.config.json', '{"libVersion":"3.16.2"}');
    await put(root, 'dist/miniprogram/stale.js', 'stale');
    const before = await stat(path.join(root, 'dist'));
    await buildProject({ root });
    expect((await stat(path.join(root, 'dist'))).ino).toBe(before.ino);
    expect(await readFile(path.join(root, 'dist/project.private.config.json'), 'utf8')).toContain('3.16.2');
    expect(await readdir(path.join(root, 'dist/miniprogram'))).not.toContain('stale.js');
  });
  it('rejects a missing entry', async () => {
    const root = await fixture();
    await rm(path.join(root, 'miniprogram/app.ts'));
    await expect(buildProject({ root })).rejects.toThrow(/app.ts/);
  });
  it('rejects a missing page resource', async () => {
    const root = await fixture();
    await put(root, 'miniprogram/app.json', '{"pages":["pages/missing/index"]}');
    await expect(buildProject({ root })).rejects.toThrow(/missing/);
  });
  it('rejects imports of server code even through shared modules', async () => {
    const root = await fixture();
    await put(root, 'cloudfunctions/common/secret.ts', 'export const value = 1;');
    await put(root, 'shared/leak.ts', "export { value } from '../cloudfunctions/common/secret';");
    await put(root, 'miniprogram/app.ts', "import { value } from '../shared/leak'; App({ value });");
    await expect(buildProject({ root })).rejects.toThrow(/client boundary/i);
  });
  it('rejects server JSON imported into the client', async () => {
    const root = await fixture();
    await put(root, 'cloudfunctions/common/settings.json', '{"value":"server-only"}');
    await put(root, 'miniprogram/app.ts', "import settings from '../cloudfunctions/common/settings.json'; App({ settings });");
    await expect(buildProject({ root })).rejects.toThrow(/client boundary/i);
  });
  it('bundles a cloud function independently with shared code', async () => {
    const root = await fixture();
    await put(root, 'shared/value.ts', 'export const value = 7;');
    await put(root, 'cloudfunctions/health/index.ts', "import { value } from '../../shared/value'; export async function main() { return value; }");
    await buildProject({ root });
    const code = await readFile(path.join(root, 'dist/cloudfunctions/health/index.js'), 'utf8');
    expect(code).toContain('value = 7');
    expect(code).not.toContain('../../shared');
    expect(JSON.parse(await readFile(path.join(root, 'dist/cloudfunctions/health/package.json'), 'utf8')).main).toBe('index.js');
  });
  it('rejects mock code in a demo build', async () => {
    const root = await fixture();
    await put(root, 'miniprogram/mock-ai.ts', 'export const result = "mock";');
    await put(root, 'miniprogram/app.ts', "import { result } from './mock-ai'; App({ result });");
    await expect(buildProject({ root, mode: 'demo' })).rejects.toThrow(/mock/i);
  });
  it('uses local account configuration only in the generated project', async () => {
    const root = await fixture();
    await put(root, 'config/local.json', '{"appid":"wx0000000000000000","cloudEnv":"test-env"}');
    await buildProject({ root });
    const project = JSON.parse(await readFile(path.join(root, 'dist/project.config.json'), 'utf8'));
    expect(project.appid).toBe('wx0000000000000000');
    expect(project.miniprogramRoot).toBe('miniprogram/');
    expect(await readFile(path.join(root, 'project.config.json'), 'utf8')).toContain('touristappid');
  });
  it.each(['{"appid":"invalid"}', '{"cloudEnv":"../env"}', '{"secret":"not-allowed"}', '{invalid'])('rejects invalid local config: %s', async config => {
    const root = await fixture();
    await put(root, 'config/local.json', config);
    await expect(buildProject({ root })).rejects.toThrow();
  });
  it('rejects a frontend network call', async () => {
    const root = await fixture();
    await put(root, 'miniprogram/app.ts', 'wx.request({url: "https://example.test"});');
    await expect(buildProject({ root })).rejects.toThrow(/Client boundary/);
  });
  it('validates component resources, styles, sitemap and tab icons', async () => {
    const root = await fixture();
    await put(root, 'miniprogram/app.json', JSON.stringify({ pages: ['pages/home/index'], sitemapLocation: 'sitemap.json', tabBar: { list: [{ pagePath: 'pages/home/index', iconPath: 'icons/home.png' }] } }));
    await put(root, 'miniprogram/icons/home.png', 'fixture-only');
    await put(root, 'miniprogram/sitemap.json', '{}');
    await put(root, 'miniprogram/pages/home/index.json', '{"usingComponents":{"state":"/components/state/index"}}');
    for (const [ext, value] of Object.entries({ ts: 'Component({});', json: '{"component":true}', wxml: '<view/>', wxss: '' })) await put(root, `miniprogram/components/state/index.${ext}`, value);
    await put(root, 'miniprogram/app.wxss', '@import "./styles/tokens.wxss";');
    await put(root, 'miniprogram/styles/tokens.wxss', 'page {}');
    await buildProject({ root, mode: 'demo' });
    await checkPackage({ root, mode: 'demo' });
    await rm(path.join(root, 'miniprogram/components/state/index.wxml'));
    await expect(validateResources(path.join(root, 'miniprogram'), 'ts')).rejects.toThrow();
  });
  it('rejects routes outside the client and invalid tab paths', async () => {
    const root = await fixture();
    await put(root, 'miniprogram/app.json', '{"pages":["../escape"]}');
    await expect(buildProject({ root })).rejects.toThrow(/Invalid resource path/);
    await put(root, 'miniprogram/app.json', '{"pages":["pages/home/index"],"tabBar":{"list":[{"pagePath":"unknown"}]}}');
    await expect(buildProject({ root })).rejects.toThrow(/Invalid tab route/);
  });
  it('rejects source and sensitive server artifacts added to the output', async () => {
    const root = await fixture();
    await buildProject({ root });
    await put(root, 'dist/miniprogram/stray.ts', '');
    await expect(checkPackage({ root })).rejects.toThrow(/Forbidden/);
    await rm(path.join(root, 'dist/miniprogram/stray.ts'));
    await put(root, 'dist/miniprogram/leak.js', 'const value = "wx-server-sdk";');
    await expect(checkPackage({ root })).rejects.toThrow(/boundary/);
  });
  it('validates documentation links and incomplete drafts', async () => {
    const root = await fixture();
    await mkdir(path.join(root, 'docs/testing'), { recursive: true });
    await put(root, 'docs/runbooks/guide.md', '# Guide\n\n- [Reference](../testing/check.md)');
    await put(root, 'docs/testing/check.md', '# Check\n- [ ] Pending external verification\n');
    expect(await verifyDocs(root)).toBe(2);
    await put(root, 'docs/testing/check.md', '# Check\n- [v] invalid');
    await expect(verifyDocs(root)).rejects.toThrow(/Invalid checklist/);
    await put(root, 'docs/testing/check.md', '# Check\nTODO');
    await expect(verifyDocs(root)).rejects.toThrow(/Incomplete/);
    await rm(path.join(root, 'docs/testing/check.md'));
    await expect(verifyDocs(root)).rejects.toThrow();
  });
});
