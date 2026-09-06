# Chat Food Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a district-only local match from feeding non-restaurant facts into a chat question about noodles or food.

**Architecture:** The `aiService` local retriever detects food intent, restricts candidate places to the restaurant category, and—when a published district is named—requires the same district before creating facts. The original chat question still reaches the existing Dify Chatflow unchanged; when no local match exists, the fallback tells it to answer directly with knowledge-base context while avoiding invented specific merchant facts.

**Tech Stack:** TypeScript, CloudBase cloud function bundle, Vitest, ESLint, TypeScript compiler.

## Global Constraints

- Do not modify Dify workflows, models, knowledge bases, API keys, prompts, or environment-variable values.
- The Mini Program continues to call only `aiService`; no credential enters client code or test output.
- Query published local place data before Dify and keep local verified facts higher priority than knowledge-base supplements.
- Deploy only the rebuilt `dist/cloudfunctions/aiService` package, preserving all current environment variables and records.
- Every behavior change starts with a failing test and ends with a focused Conventional Commit.

---

### Task 1: Filter food questions by category and district

**Files:**
- Modify: `tests/unit/ai-service.test.ts`
- Modify: `cloudfunctions/ai/retrieval.ts`

**Interfaces:**
- A chat request containing a food term such as `吃面` limits local candidates to `category === 'restaurant'`.
- If the question names a district that exists in a published place, candidates must also have that district.
- The no-match fact tells Dify to answer the question directly while not inventing a specific merchant, price, operating status, traffic schedule, or reservation rule.

- [ ] **Step 1: Add a failing regression test**

Add published fixtures for an `夷陵区` noodle restaurant, an `夷陵区` scenic place with fish text, and a restaurant in another district. Call the retriever with `夷陵区有什么吃面的地方？`; expect only the noodle restaurant fact. Call with a food question that has no local match; expect the no-match fact to contain `直接回答用户问题` and `不要虚构具体商户`.

- [ ] **Step 2: Run the focused test to verify red**

Run: `node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-service.test.ts`

Expected: FAIL because the existing district string matches every category in that district and the fallback does not guide a direct answer.

- [ ] **Step 3: Implement the narrow candidate filter**

Normalize the question, detect food terms (`餐馆`、`餐厅`、`美食`、`吃`、`面`、`粉`、`早餐`、`小吃`、`饭`、`宵夜`), derive a named district only from published place districts, and filter candidates before the existing field matcher. Add food terms to restaurant matching terms so a food question can find restaurants even when its name lacks the generic word `餐馆`. Preserve the five-result maximum and all existing missing-content handling.

- [ ] **Step 4: Verify behavior and cloud bundle boundary**

Run:

```powershell
node node_modules\\vitest\\vitest.mjs run tests\\unit\\ai-service.test.ts tests\\unit\\dify-adapter.test.ts
node node_modules\\typescript\\bin\\tsc --noEmit
node node_modules\\eslint\\bin\\eslint.js cloudfunctions\\ai\\retrieval.ts tests\\unit\\ai-service.test.ts
node scripts\\build.mjs --mode=demo
node scripts\\check-package.mjs
```

Expected: all commands exit 0; the client package contains no Dify credential or direct Dify call.

- [ ] **Step 5: Commit the retrieval change**

```powershell
git add -- cloudfunctions/ai/retrieval.ts tests/unit/ai-service.test.ts
git diff --cached --check
git commit -m "fix: narrow chat food fact retrieval"
```

### Task 2: Record deployment-safe verification

**Files:**
- Create: `docs/testing/2026-09-06-chat-food-retrieval-qa.md`

- [ ] **Step 1: Record actual local checks and deployment boundary**

Record each commit and actual command result. State that `dist/cloudfunctions/aiService` is the only deployment target, all environment variables remain unchanged, no live Dify request was made during local checks, and the manual smoke question is `夷陵区有什么吃面的地方？`.

- [ ] **Step 2: Validate and commit the record**

Run:

```powershell
node scripts\\verify-docs.mjs
git add -- docs/testing/2026-09-06-chat-food-retrieval-qa.md
git diff --cached --check
git commit -m "test: record chat food retrieval QA"
```

Expected: both commands exit 0.

### Task 3: Deploy and smoke test the cloud function

**Target:** `dist/cloudfunctions/aiService`

- [ ] **Step 1: Deploy only the rebuilt function package**

Upload `dist/cloudfunctions/aiService` as the `aiService` cloud function. Retain existing dependencies, timeout, environment variables, Dify settings and CloudBase data; do not open, copy, replace, or log any environment-variable values.

- [ ] **Step 2: Verify the deployed chat path**

In WeChat Developer Tools, start a fresh chat and send `夷陵区有什么吃面的地方？`. Confirm the answer focuses on noodle/restaurant information, does not present unrelated fish/scenic/camping facts as noodle places, and still shows the standard official-information disclaimer.

- [ ] **Step 3: Record factual deployment outcome**

Append only the actual deployment outcome, manual result, and any remaining limitations to the QA record. If the live model still produces a wrong answer despite clean local facts, stop and request approval for a Dify-only prompt change rather than silently changing it.
