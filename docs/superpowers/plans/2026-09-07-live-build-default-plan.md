# Live Build Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure everyday and command-line builds produce a real CloudBase/Dify experience package, while mock AI output requires an explicit development command.

**Architecture:** Keep `buildProject()` programmatic default as `development` for isolated unit fixtures. Export a narrow CLI-mode resolver that defaults to `demo`; the executable build script uses it. Package scripts make the same choice explicit with a new `build:dev` escape hatch. Tests verify resolver and script contract without any network or credentials.

**Tech Stack:** Node.js ESM, TypeScript, Vitest, ESLint, esbuild, Markdown.

## Global Constraints

- Do not modify AI page behavior, Dify, CloudBase functions, databases, environment variables, keys, AppID, or output directory layout.
- Do not read or print `config/local.json` values.
- `dist` remains generated output and must be built in `demo` mode for experience-version verification.
- Preserve development-mode unit fixture behavior through `buildProject({ mode: 'development' })`.
- Stage only files owned by this change; do not touch existing untracked files or the user-modified `project.config.json`.

---

### Task 1: Make real experience builds the default

**Files:**
- Modify: `scripts/build.mjs:8-9,85-89`
- Modify: `package.json:12-16`
- Modify: `tests/unit/build.test.ts:1-2,118-145`
- Modify: `docs/testing/2026-09-07-release-checklist.md:13-20,44-48`

**Interfaces:**
- Consumes: CLI arguments shaped as `--mode=demo` or `--mode=development`.
- Produces: `resolveCliBuildMode(args: string[]): 'demo' | 'development' | string`; no mode defaults to `demo`, while invalid modes continue to be rejected by `buildProject()`.

- [ ] **Step 1: Write the failing regression tests**

Import `resolveCliBuildMode` from `scripts/build.mjs`. Add one test:

```ts
it('defaults executable builds to demo and keeps development explicit', async () => {
  expect(resolveCliBuildMode([])).toBe('demo');
  expect(resolveCliBuildMode(['--mode=demo'])).toBe('demo');
  expect(resolveCliBuildMode(['--mode=development'])).toBe('development');
});
```

Add one package-script assertion:

```ts
const manifest = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'));
expect(manifest.scripts.build).toBe('node scripts/build.mjs --mode=demo');
expect(manifest.scripts['build:demo']).toBe('node scripts/build.mjs --mode=demo');
expect(manifest.scripts['build:dev']).toBe('node scripts/build.mjs --mode=development');
```

- [ ] **Step 2: Verify the test is red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\build.test.ts`

Expected: FAIL because `resolveCliBuildMode` is absent and the existing `build` script omits `--mode=demo`.

- [ ] **Step 3: Implement the narrow mode boundary**

Add this exported helper above `buildProject()`:

```js
export function resolveCliBuildMode(args) {
  return args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'demo';
}
```

Leave `buildProject({ mode = 'development' })` unchanged. Replace the executable entry point's inline default with:

```js
const mode = resolveCliBuildMode(process.argv.slice(2));
```

In `package.json`, set `build` and `build:demo` to `node scripts/build.mjs --mode=demo`, and add `build:dev` as `node scripts/build.mjs --mode=development`.

Update the release checklist to tell operators to run `npm run build` for the real experience package and reserve `npm run build:dev` for intentionally simulated local interaction.

- [ ] **Step 4: Verify focused behavior and commit**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\build.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js scripts\\build.mjs tests\\unit\\build.test.ts
node scripts\\verify-docs.mjs
```

Then stage only the four Task 1 files, run `git diff --cached --check`, and commit with `fix: default builds to live AI mode`.

### Task 2: Verify the final experience package and record QA

**Files:**
- Create: `docs/testing/2026-09-07-live-build-default-qa.md`

**Interfaces:**
- Consumes: Task 1 committed build behavior.
- Produces: a factual local release-build handoff; real CloudBase and device verification remain separately marked pending.

- [ ] **Step 1: Run final local checks**

```powershell
npm run build
node node_modules\\vitest\\vitest.mjs run
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js .
node scripts\\validate-content.mjs
node scripts\\verify-docs.mjs
node scripts\\check-package.mjs
git diff --check
```

After the build, inspect `dist/miniprogram/services/ai.js` and assert it calls `aiService`, has `isDevelopmentMock()` compiled to `false`, and contains neither `模拟回答` nor `模拟行程建议`.

- [ ] **Step 2: Record actual results and pending external validation**

Document the old shared-output root cause, the new explicit `build:dev` command, actual test totals, and that the following are not verified by local tests: deployed cloud functions, environment-variable names, published cloud data, real Dify response, Android/iPhone tests, and experience-version upload.

- [ ] **Step 3: Commit the QA record**

```powershell
git add -- docs/testing/2026-09-07-live-build-default-qa.md
git diff --cached --check
git commit -m "test: record live build default QA"
```

## Plan Self-Review

- The plan fixes the shared `dist` overwrite at both entry points used in practice: `npm run build` and direct script invocation.
- Programmatic default behavior remains unchanged for current unit fixtures.
- The only mock-producing convenience command is named explicitly and documented.
- No cloud, Dify, secret, or data mutation enters this plan.
