# 有封面地点优先展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让发现列表在每个现有筛选结果内优先展示已绑定封面的地点，但不隐藏任何已发布地点。

**Architecture:** 在 `createPlaceRepository().list()` 的内存筛选结果中，将封面状态作为排序第一键，名称和 `_id` 保持原来的稳定第二、三键。分页游标继续使用原有 `[name, id]`，因为这两个字段在最终列表中仍唯一。

**Tech Stack:** TypeScript、Vitest、微信云函数。

## Global Constraints

- 不写入 `places`、`place_contents` 或云存储。
- 不改 Dify、环境变量、密钥、云函数公开接口或权限。
- 无封面已发布地点仍可搜索、筛选、翻页和进入详情。
- 代码改动必须先有失败测试，并以单独 Conventional Commit 提交；独立测试记录另行提交。

---

### Task 1: 仓储排序与回归测试

**Files:**
- Modify: `tests/unit/place-service.test.ts`
- Modify: `cloudfunctions/places/repository.ts`

**Interfaces:**
- Consumes: `createPlaceRepository(database).list({ category?, keyword?, tags?, cursor?, pageSize? })`
- Produces: 与现有 `PageResult<PlaceSummary>` 相同的列表契约，仅改变条目顺序。

- [ ] **Step 1: 写失败测试。**

在 `tests/unit/place-service.test.ts` 增加一个含三个已发布合成地点的数据库：名称最靠前的地点 `coverFileId: null`，名称较后的地点 `coverFileId: 'cloud://approved-bucket/cover.jpg'`，第三个无封面。断言 `pageSize: 1` 的第一页为有封面地点，第二页为首个无封面地点，第三页为另一个无封面地点。

- [ ] **Step 2: 运行目标测试并确认失败。**

Run: `node .local-tools/package/bin/npm-cli.js run test -- tests/unit/place-service.test.ts`

Expected: 新增断言失败，因为当前实现只按名称排序。

- [ ] **Step 3: 实现最小排序。**

在 `cloudfunctions/places/repository.ts` 的 `filtered` 排序比较器中，先比较 `typeof document.coverFileId === 'string' && document.coverFileId.length > 0`，有封面为前；相同状态时保留 `` `${name}\u0000${_id}`.localeCompare(...) ``。不改过滤、游标编码或数据读取。

- [ ] **Step 4: 运行目标测试并确认通过。**

Run: `node .local-tools/package/bin/npm-cli.js run test -- tests/unit/place-service.test.ts`

Expected: 全部通过，新增测试证明有封面优先且分页连续。

- [ ] **Step 5: 运行交付检查。**

Run: `node .local-tools/package/bin/npm-cli.js run test`

Run: `node .local-tools/package/bin/npm-cli.js run typecheck`

Run: `node .local-tools/package/bin/npm-cli.js run lint`

Run: `node .local-tools/package/bin/npm-cli.js run build`

Run: `node .local-tools/package/bin/npm-cli.js run check:package`

Run: `node .local-tools/package/bin/npm-cli.js run verify:docs`

Expected: 全部通过。

- [ ] **Step 6: 创建功能提交。**

```powershell
git add cloudfunctions/places/repository.ts tests/unit/place-service.test.ts
git commit -m "fix: prioritize places with covers"
```

### Task 2: 独立验收记录

**Files:**
- Create: `docs/testing/2026-09-07-covered-place-priority-qa.md`

- [ ] **Step 1: 独立复验。**

由未参与实现的测试角色运行目标测试和交付检查，确认无封面地点未被过滤、分页连续、无云端写入，并记录被测 commit、结果、缺陷和未测项。

- [ ] **Step 2: 提交验收记录。**

```powershell
git add docs/testing/2026-09-07-covered-place-priority-qa.md
git commit -m "docs: record covered place priority QA"
```
