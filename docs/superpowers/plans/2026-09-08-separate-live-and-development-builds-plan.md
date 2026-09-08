# 真实与模拟构建目录隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让真实 AI 体验包和模拟开发包使用不同目录，任何开发构建都不能覆盖微信开发者工具使用的真实包。

**Architecture:** 新增一个不依赖构建工具的纯路径模块，按模式将 `demo` 映射到 `dist`、将 `development` 映射到 `dist-dev`。构建器和包检查器共同使用这个模块，避免两个脚本再次对输出目录产生不同理解。微信项目入口仍指向 `dist`，不改云端边界。

**Tech Stack:** Node.js ESM、esbuild、Vitest、ESLint、PowerShell、Markdown。

## Global Constraints

- `dist` 只能由 `demo` 模式写入，并继续是微信开发者工具和体验版目录。
- `dist-dev` 只能由 `development` 模式写入，允许模拟回答，且不作为上传目录。
- 不改 Dify、云函数、云数据库、环境变量、密钥、AppID 或用户位置行为。
- 不读取或输出 `config/local.json` 的实际内容。
- 不碰用户已修改的 `project.config.json`、未跟踪图片、备份或其他无关文件。
- 每项逻辑改动先有失败测试，相关检查通过后创建聚焦 Git commit；验收记录单独提交。

---

### Task 1: 统一模式到输出目录的映射

**Files:**
- Create: `scripts/build-output.mjs`
- Modify: `scripts/build.mjs:1-95`
- Modify: `scripts/check-package.mjs:1-63`
- Modify: `tests/unit/build.test.ts:1-190`
- Modify: `.gitignore:8-14`

**Interfaces:**
- Consumes: `root: string` 与 `mode: 'demo' | 'development'`。
- Produces: `resolveBuildOutput(root, mode): string`；`demo` 返回 `<root>/dist`，`development` 返回 `<root>/dist-dev`，其他模式抛出 `Invalid build mode`。
- `buildProject({ root, mode })` 和 `checkPackage({ root, mode })` 都使用该函数，不再手写输出目录。

- [ ] **Step 1: 写入失败的目录隔离回归测试**

在 `tests/unit/build.test.ts` 导入 `resolveBuildOutput`，新增以下测试，并把所有默认 `buildProject({ root })` 的产物断言从 `dist` 改为 `dist-dev`：

```ts
it('separates live and development outputs so a development build cannot overwrite the live package', async () => {
  const root = await fixture();
  expect(resolveBuildOutput(root, 'demo')).toBe(path.join(root, 'dist'));
  expect(resolveBuildOutput(root, 'development')).toBe(path.join(root, 'dist-dev'));

  await buildProject({ root, mode: 'demo' });
  const liveBefore = await readFile(path.join(root, 'dist/miniprogram/app.js'), 'utf8');
  await buildProject({ root, mode: 'development' });

  expect(await readFile(path.join(root, 'dist/miniprogram/app.js'), 'utf8')).toBe(liveBefore);
  expect(await readFile(path.join(root, 'dist-dev/miniprogram/app.js'), 'utf8')).toContain('App(');
});
```

在 `.gitignore` 的构建输出段加入 `dist-dev/`。

- [ ] **Step 2: 运行定向测试确认失败**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\build.test.ts
```

Expected: FAIL，因为 `build-output.mjs` 尚不存在，且开发构建仍写入 `dist`。

- [ ] **Step 3: 实现单一输出路径模块并接入构建、检查器**

新建 `scripts/build-output.mjs`：

```js
import path from 'node:path';

export function resolveBuildOutput(root, mode) {
  if (!['development', 'demo'].includes(mode)) throw new Error('Invalid build mode');
  return path.join(path.resolve(root), mode === 'demo' ? 'dist' : 'dist-dev');
}
```

在 `scripts/build.mjs` 导入该函数，将：

```js
const output = path.join(root, 'dist');
```

替换为：

```js
const output = resolveBuildOutput(root, mode);
```

保留现有模式校验；将安全路径校验的固定 `'dist'` 改为：

```js
const expectedOutputName = mode === 'demo' ? 'dist' : 'dist-dev';
if (path.dirname(output) !== root || path.basename(output) !== expectedOutputName) {
  throw new Error('Unsafe output path');
}
```

在 `scripts/check-package.mjs` 导入同一函数，并将：

```js
const client = path.join(root, 'dist/miniprogram');
```

替换为：

```js
const client = path.join(resolveBuildOutput(root, mode), 'miniprogram');
```

保留 `checkPackage` 的默认 `development`，使程序化开发构建与它的默认检查仍匹配 `dist-dev`。

- [ ] **Step 4: 运行定向检查确认通过**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\build.test.ts
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js scripts\build-output.mjs scripts\build.mjs scripts\check-package.mjs tests\unit\build.test.ts
node scripts\verify-docs.mjs
git diff --check
```

Expected: 构建单测通过，类型、Lint、文档和空白检查均退出 0。

- [ ] **Step 5: 提交目录隔离逻辑**

```powershell
git add -- scripts/build-output.mjs scripts/build.mjs scripts/check-package.mjs tests/unit/build.test.ts .gitignore
git diff --cached --check
git commit -m "fix: isolate development build output"
```

### Task 2: 固化真实包并更新操作说明

**Files:**
- Modify: `docs/runbooks/development.md:21-46,75-78`
- Modify: `docs/testing/2026-09-07-release-checklist.md:44-48`
- Modify: `tests/unit/build.test.ts:45-70`

**Interfaces:**
- Consumes: Task 1 的 `resolveBuildOutput` 和已隔离的构建目录。
- Produces: 面向操作者的固定规则：开发者工具只导入 `dist`；`npm run build:dev` 只生成 `dist-dev`；每次真实测试或上传前运行 `npm run build`。

- [ ] **Step 1: 写入失败的操作约定测试**

在现有 package-script 断言中加入文档文本断言：

```ts
const developmentRunbook = await readFile(path.join(process.cwd(), 'docs/runbooks/development.md'), 'utf8');
expect(developmentRunbook).toContain('`dist`');
expect(developmentRunbook).toContain('`dist-dev`');
expect(developmentRunbook).toContain('`npm run build:dev`');
```

先不要修改文档，运行定向测试应因 `dist-dev` 说明缺失而失败。

- [ ] **Step 2: 更新开发与体验版指引**

在 `docs/runbooks/development.md` 的导入步骤明确写入：

```markdown
- 开发者工具只导入 `dist`。它是调用 `aiService` 的真实体验包。
- `npm run build:dev` 会生成 `dist-dev` 的模拟包，仅用于界面开发；不要在开发者工具中导入它，也不要上传它。
- 修改页面后，准备真实测试或上传前执行 `npm run build`，再在工具内点击“编译”。
```

将“输出为 `dist/miniprogram/`”改成同时说明 `dist` 与 `dist-dev` 的职责。更新发布清单第一步：体验版只运行 `npm run build` 并导入 `dist`，不使用 `build:dev`。

- [ ] **Step 3: 运行定向检查确认通过**

Run:

```powershell
node node_modules\vitest\vitest.mjs run tests\unit\build.test.ts
node scripts\verify-docs.mjs
git diff --check
```

Expected: 通过；文档不含未完成标记或敏感配置值。

- [ ] **Step 4: 提交使用边界说明**

```powershell
git add -- docs/runbooks/development.md docs/testing/2026-09-07-release-checklist.md tests/unit/build.test.ts
git diff --cached --check
git commit -m "docs: clarify isolated build outputs"
```

### Task 3: 重建真实包并记录验收

**Files:**
- Create: `docs/testing/2026-09-08-build-output-isolation-qa.md`

**Interfaces:**
- Consumes: 两个已隔离目录和当前小程序源码。
- Produces: 新鲜的 `dist` 真实 AI 包；QA 记录实际命令、结果、未测云端和真机项。

- [ ] **Step 1: 执行真实/模拟互不覆盖的产物验证**

Run:

```powershell
node scripts\build.mjs --mode=demo
$liveBefore = Get-FileHash dist\miniprogram\services\ai.js -Algorithm SHA256
node scripts\build.mjs --mode=development
$liveAfter = Get-FileHash dist\miniprogram\services\ai.js -Algorithm SHA256
if ($liveBefore.Hash -ne $liveAfter.Hash) { throw 'Development build overwrote live dist.' }
$live = Get-Content dist\miniprogram\services\ai.js -Raw
$dev = Get-Content dist-dev\miniprogram\services\ai.js -Raw
if ($live -notmatch 'aiService' -or $live -match '模拟回答|模拟行程') { throw 'Live package is not real AI.' }
if ($dev -notmatch '模拟回答|模拟行程') { throw 'Development package is not mock AI.' }
node scripts\build.mjs --mode=demo
```

Expected: 哈希一致；`dist` 为真实 AI 包，`dist-dev` 为模拟包；最后一次 demo 构建确保开发者工具当前可加载真实包。

- [ ] **Step 2: 运行全量本地检查**

Run:

```powershell
node node_modules\vitest\vitest.mjs run
node node_modules\typescript\bin\tsc --noEmit
node node_modules\eslint\bin\eslint.js .
node scripts\validate-content.mjs
node scripts\verify-docs.mjs
node scripts\check-package.mjs --mode=demo
git diff --check
```

Expected: 所有可用本地检查通过；真实 Dify、CloudBase、微信开发者工具和 Android/iPhone 真机测试仍单独标注待验。

- [ ] **Step 3: 写入并提交验收记录**

记录被测提交、模拟包覆盖的根因、`dist`/`dist-dev` 边界、每条实际命令和结果，以及未执行的云端/真机验证。然后执行：

```powershell
git add -- docs/testing/2026-09-08-build-output-isolation-qa.md
git diff --cached --check
git commit -m "test: record build output isolation QA"
```

## Plan Self-Review

- 设计中的五项验收标准分别由 Task 1 的目录隔离测试、Task 2 的操作说明断言、Task 3 的真实产物哈希与文本检查覆盖。
- 输出路径只在新模块定义一次，构建器和包检查器共享它，避免再次形成两个相互矛盾的目录规则。
- 计划不触及云端、Dify、密钥、数据库、AppID、用户位置或用户未跟踪文件。
- 已逐项检查路径、函数名、模式值和命令；无待填占位符或跨任务未定义的接口。
