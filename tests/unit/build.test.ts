import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProject } from '../../scripts/build.mjs';
import { checkPackage, validateResources } from '../../scripts/check-package.mjs';
import { verifyDocs } from '../../scripts/verify-docs.mjs';

const roots: string[] = [];

function findSecretLikeRunbookValues(text: string) {
  const patterns = [
    /["']?\bDIFY_[A-Z0-9_]+\b["']?\s*(?:=|:)\s*["']?\S+/g,
    /\bapp-(?=[A-Za-z0-9_-]{24,}\b)(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]+\b/g,
    /\bBearer\s+\S+/gi,
    /\b(?:wx[a-z0-9]{16}|lam-[a-z0-9]+)\b/gi,
    /["']?\b(?:account(?:Id)?|loginUin|envId|conversation(?:Id|_id)?|attempt(?:Token|_token))\b["']?\s*(?:=|:)\s*["']?[A-Za-z0-9_-]{4,}/gi,
    /(?:\u817e\u8baf\u4e91\u8d26\u53f7|\u8d26\u6237(?:ID)?|\u8d26\u53f7(?:ID)?)\s*[:\uff1a]?\s*`?\d{6,}`?/gi,
    /CloudBase\s*\u73af\u5883\s*`?[A-Za-z0-9-]{20,}`?/gi,
  ];
  return patterns.flatMap(pattern => text.match(pattern) ?? []);
}

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
  it('keeps import.meta.url runnable in CommonJS cloud-function bundles', async () => {
    const root = await fixture();
    await put(root, 'cloudfunctions/health/index.ts', "import { createRequire } from 'node:module'; const load = createRequire(import.meta.url); exports.main = () => typeof load;");
    await buildProject({ root });
    const loadBundle = createRequire(import.meta.url);
    const bundle = loadBundle(path.join(root, 'dist/cloudfunctions/health/index.js')) as { main: () => string };
    expect(bundle.main()).toBe('function');
  });
  it('declares the CloudBase server SDK required by aiService', async () => {
    const manifest = JSON.parse(await readFile(path.join(process.cwd(), 'cloudfunctions/aiService/package.json'), 'utf8'));
    expect(manifest.dependencies).toEqual({ 'wx-server-sdk': '4.0.2' });
  });
  it('declares the CloudBase server SDK required by placeService', async () => {
    const manifest = JSON.parse(await readFile(path.join(process.cwd(), 'cloudfunctions/placeService/package.json'), 'utf8'));
    expect(manifest.dependencies).toEqual({ 'wx-server-sdk': '4.0.2' });
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
  it('allows the AI cloud-function boundary but rejects Dify configuration in a demo client', async () => {
    const root = await fixture();
    await put(root, 'miniprogram/services/ai.ts', 'export async function submitAi() { return wx.cloud.callFunction({ name: "aiService" }); }');
    await buildProject({ root, mode: 'demo' });
    expect(await readFile(path.join(root, 'dist/miniprogram/services/ai.js'), 'utf8')).toContain('aiService');
    await put(root, 'miniprogram/services/ai.ts', 'const endpoint = "https://api.dify.ai"; export { endpoint };');
    await expect(buildProject({ root, mode: 'demo' })).rejects.toThrow(/Client boundary/);
    for (const leak of ['DIFY_CHAT_API_KEY', 'Authorization: "Bearer secret"', '"/v1/chat-messages"']) {
      await put(root, 'miniprogram/services/ai.ts', `export const leaked = ${JSON.stringify(leak)};`);
      await expect(buildProject({ root, mode: 'demo' })).rejects.toThrow(/Client boundary/);
    }
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
    await put(root, 'dist/miniprogram/leak.js', 'const value = "DIFY_TRIP_API_KEY";');
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
  it('documents only the required Dify variable names and hardening deployment resources', async () => {
    const runbook = await readFile(path.join(process.cwd(), 'docs/runbooks/dify-chatflow.md'), 'utf8');
    const allowedDifyNames = [
      'DIFY_BASE_URL',
      'DIFY_CHAT_API_KEY',
      'DIFY_TRIP_API_KEY',
    ];
    expect([...new Set(runbook.match(/\bDIFY_[A-Z0-9_]+\b/g) ?? [])].sort()).toEqual(allowedDifyNames.sort());
    for (const name of [
      ...allowedDifyNames,
      'ai_sessions',
      'usage_counters',
      'ai_messages',
      'trip_requests',
      'ADMINONLY',
      '120 秒',
      '45 秒',
      'destination',
      'people',
      'totalBudgetCny',
      'days',
      'preferences',
      'local_verified_facts',
      'query',
      'ownerId ASC + createdAt DESC + _id ASC',
      'TTL',
      '保留现有环境变量',
      "wx.cloud.callFunction({ name: 'aiService' })",
      'published',
      '独立会话',
      '不要打印',
      '回滚',
      'Dify 公共 HTTPS API Endpoint',
      '可以带或不带 `/v1`',
      '不得带 `/chat-messages`',
      '已发布的 `chat` 应用 API 凭据',
      '已发布的 `trip` 应用 API 凭据',
      '不要交换',
      '`chat` 和 `trip` 两个 Chatflow 都配置可选文本变量 `local_verified_facts`',
      '`expiresAt`',
      '仅删除已过期',
      '记录为待办',
      '不要误删',
    ]) {
      expect(runbook).toContain(name);
    }
    expect(runbook).not.toContain('DIFY_CHAT_API_BASE_URL');
    expect(runbook).not.toContain('DIFY_TRIP_API_BASE_URL');
    expect(findSecretLikeRunbookValues(runbook)).toEqual([]);
  });
  it('keeps every testing record free of private infrastructure identifiers', async () => {
    const directory = path.join(process.cwd(), 'docs/testing');
    for (const file of (await readdir(directory)).filter(name => name.endsWith('.md'))) {
      const text = await readFile(path.join(directory, file), 'utf8');
      expect(findSecretLikeRunbookValues(text), file).toEqual([]);
    }
  });
  it('documents the non-secret user-collected workbook import and recovery route', async () => {
    const runbook = await readFile(path.join(process.cwd(), 'docs/runbooks/content-import.md'), 'utf8');
    for (const text of ['--source', '.local/import/', 'JSON Lines', 'Upsert', 'place_contents', 'places', '向半斗整理收集', '不要在本说明']) {
      expect(runbook).toContain(text);
    }
    expect(runbook.indexOf('导入 `place_contents.json`')).toBeLessThan(runbook.indexOf('导入 `places.json`'));
    expect(findSecretLikeRunbookValues(runbook)).toEqual([]);
  });
  it.each([
    ['Dify equals assignment', `DIFY_CHAT_API_KEY=${'x'.repeat(32)}`],
    ['Dify colon assignment', 'DIFY_BASE_URL: https://service.example.test/v1'],
    ['common Dify key', `app-${'x'.repeat(20)}1234567890`],
    ['quoted Dify key', JSON.stringify({ DIFY_CHAT_API_KEY: `app-${'x'.repeat(20)}1234567890` })],
    ['Bearer value', `Bearer ${'x'.repeat(24)}`],
    ['WeChat AppID', `wx${'0'.repeat(16)}`],
    ['account label', 'account=fixture-account'],
    ['login label', 'loginUin: fixture-login'],
    ['environment label', 'envId=fixture-environment'],
    ['quoted environment label', JSON.stringify({ envId: 'fixture-environment' })],
    ['conversation label', 'conversationId: fixture-conversation'],
    ['attempt label', 'attemptToken=fixture-attempt'],
  ])('detects a secret-like runbook value: %s', (_label, sample) => {
    expect(findSecretLikeRunbookValues(sample)).not.toEqual([]);
  });
  it.each([
    'DIFY_BASE_URL',
    '`DIFY_CHAT_API_KEY`',
    'envId',
    '"conversationId"',
    'attemptToken',
    'app-configuration-guide',
    '目标环境名称',
  ])('allows a runbook name or non-secret reference: %s', sample => {
    expect(findSecretLikeRunbookValues(sample)).toEqual([]);
  });
});
