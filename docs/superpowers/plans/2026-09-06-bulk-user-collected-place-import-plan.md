# Bulk User-Collected Place Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the user-supplied Dify workbook into published `places` and `place_contents` JSON Lines files, import them into the existing CloudBase collections, and present the material transparently as user-collected local reference.

**Architecture:** A local-only workbook converter reads a supplied `.xlsx` path and produces deterministic CloudBase JSON Lines for the two existing collections. It never copies the workbook into the repository or mini-program package. Public records carry `sourceLevel: "user_collected"`; the existing retrieval and source presentation paths use that field to avoid calling the material officially verified.

**Tech Stack:** bundled Python with `openpyxl`, Node.js 22, TypeScript, Vitest, CloudBase Console JSON Lines import with Upsert.

## Global Constraints

- Import the user’s full workbook into the existing `places` and `place_contents` collections; do not create a new data service or admin UI.
- Records are public in the controlled mini-program experience, but source text must be “向半斗整理收集” and volatile facts remain reference-only with an official-announcement disclaimer.
- Keep `ADMINONLY` collection access, server-only Dify credentials, user-record isolation, and the frontend prohibition on direct Dify calls.
- Generated workbook exports and JSON Lines stay under ignored `.local/`; never commit the workbook, generated records, API keys, or CloudBase credentials.
- Use CloudBase Console **Upsert** import for deterministic `_id` records. Export existing collections before any write.

---

### Task 1: Add a tested workbook-to-record converter

**Files:**
- Create: `scripts/convert_user_collected_workbook.py`
- Create: `tests/unit/test_user_collected_import.py`

**Consumes:** an `.xlsx` workbook with the 17 user-provided columns.

**Produces:** `convert_workbook_rows(rows, imported_at)` returning `{ places, contents, report }`, and CLI output at `.local/import/places.json` and `.local/import/place_contents.json` (JSON Lines content with CloudBase-compatible `.json` extensions).

- [ ] **Step 1: Add failing mapping tests**

Create three object rows covering a scenic overview, a restaurant and a camping row. Assert category mapping, stable ASCII `placeId`, parsed `longitude,latitude`, `status: 'published'`, `sourceLevel: 'user_collected'`, the exact source title, and paired details. Include a malformed coordinate row and assert that it appears in `report.rejected` and produces no document.

- [ ] **Step 2: Run the focused test to confirm the converter is absent**

Run: `python -m unittest tests/unit/test_user_collected_import.py`

Expected: FAIL because `convert_user_collected_workbook.py` does not exist.

- [ ] **Step 3: Use bundled openpyxl and implement the pure mapping**

Implement these functions:

```js
def convert_workbook_rows(rows, imported_at):  # returns places, contents, report
def convert_workbook(source_path, output_dir, imported_at=None):  # reads first sheet and writes JSON Lines
```

Map categories exactly as specified in the design. Build `placeId` from a normalized Chinese name plus a short SHA-256 suffix so repeated runs are stable and collisions cannot overwrite another row. Use `coverFileId: null`, `coordinateSystem: 'GCJ-02'`, `status: 'published'`, `sourceLevel: 'user_collected'`, and one source record with title `向半斗整理收集`, `url: null`, a collection note, and the imported timestamp. Set `openNotice` to the fixed `资料参考，出行前请以官方公告为准。`; put price, opening-hour, facilities and parking cells only in a bounded text `sections` reference block, never in `intro`, `openNotice`, `visitAdvice`, or `diningInfo`, because the latter fields are sent to Dify. Strip control characters and cap every mapped field before output.

- [ ] **Step 4: Add CLI validation and JSON Lines writer**

Require `--source <path>` and optional `--out <directory>`. Reject a workbook whose first-sheet header does not contain all 17 expected names. Write one UTF-8 JSON object per line with `_id` equal to `placeId`; report only counts, category totals and rejected row numbers. Ensure output directories are created only beneath the repository `.local/import/` directory.

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
python -m unittest tests/unit/test_user_collected_import.py
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
```

Expected: PASS.

Commit:

```powershell
git add -- scripts/convert_user_collected_workbook.py tests/unit/test_user_collected_import.py
git commit -m "feat: convert user-collected place workbook"
```

### Task 2: Present imported material as local reference, not official verification

**Files:**
- Modify: `cloudfunctions/ai/retrieval.ts`
- Modify: `cloudfunctions/places/repository.ts`
- Modify: `shared/contracts.ts`
- Modify: `miniprogram/components/source-card/index.wxml`
- Modify: `miniprogram/pages/place-detail/index.wxml`
- Modify: `tests/unit/ai-service.test.ts`
- Modify: `tests/unit/components.test.ts`
- Modify: `tests/unit/place-service.test.ts`

**Consumes:** `places.sourceLevel` from Task 1.

**Produces:** source cards and Dify context that clearly distinguish user-collected reference from verified local facts, while matching imported records beyond the first database page.

- [ ] **Step 1: Add failing trust-label tests**

Add a `sourceLevel: 'user_collected'` published place fixture. Assert retrieval returns `【本地整理参考】` and includes the official-announcement warning. Preserve the existing `【本地已核验资料】` expectation for records without that field. Assert the source-card heading uses `本地资料参考`. Assert the detail projection emits `kind: 'local_reference'` rather than `local_verified`, and the detail page uses `资料说明` plus the exact collection label and official-announcement warning. Add 51 published records where only the final record matches the question; assert it is found, so a bulk import cannot be silently truncated at 50 records.

- [ ] **Step 2: Run focused tests to confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/ai-service.test.ts tests/unit/components.test.ts`

Expected: FAIL because the application always calls local facts verified.

- [ ] **Step 3: Implement the source-level branch**

In `shared/contracts.ts`, add the explicit `local_reference` source kind. In `repository.ts`, project `sourceLevel: 'user_collected'` as `local_reference`; preserve `local_verified` for existing curated records. In `retrieval.ts`, select the prefix based on `place.sourceLevel === 'user_collected'`. For user-collected records, append `价格、营业时间、交通和预约请以官方公告为准。`; do not alter matching, database-before-Dify ordering, or the existing no-match uncertainty text. Read published places in fixed 100-record pages until the final short page before applying the existing five-result cap; do not replace this with a larger arbitrary `limit`. Rename the source-card heading from `本地已核验资料` to `本地资料参考`; in the detail page render `资料说明` and the collection label for `local_reference`, while curated data retains its existing label.

- [ ] **Step 4: Run focused tests and commit**

Run the two focused test files plus typecheck and lint. Commit:

```powershell
git add -- cloudfunctions/ai/retrieval.ts miniprogram/components/source-card/index.wxml tests/unit/ai-service.test.ts tests/unit/components.test.ts
git commit -m "feat: label user-collected local references"
```

### Task 3: Document and verify the controlled CloudBase import procedure

**Files:**
- Modify: `docs/runbooks/content-import.md`
- Modify: `tests/unit/build.test.ts`

**Consumes:** JSON Lines files from Task 1.

**Produces:** exact non-secret console procedure: export backup, import `place_contents` then `places` using Upsert, and post-import verification.

- [ ] **Step 1: Add a failing runbook contract test**

Require the runbook to contain `--source`, `.local/import`, `JSON Lines`, `Upsert`, `places`, `place_contents`, `向半斗整理收集`, and the no-secret rule.

- [ ] **Step 2: Run the test to confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/build.test.ts`

Expected: FAIL because the runbook has no workbook import route.

- [ ] **Step 3: Add the runbook**

Document the exact sequence: run the converter locally; inspect the count-only report; export each existing target collection through CloudBase Console; import `place_contents.json` first and then `places.json` as JSON with **Upsert**; keep both collections `ADMINONLY`; inspect one record from every category; and roll back by re-importing the console exports or setting the batch to `draft`. CloudBase Console performs two independent imports, not a cross-collection transaction: if either fails, stop, do not claim a complete import, and restore the successful collection before retrying. State that generated files and workbook values never enter Git, chat, logs or the mini-program package.

- [ ] **Step 4: Run documentation checks and commit**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/build.test.ts
node scripts/verify-docs.mjs
git diff --check
```

Commit:

```powershell
git add -- docs/runbooks/content-import.md tests/unit/build.test.ts
git commit -m "docs: add user-collected place import runbook"
```

### Task 4: Generate, import, and independently verify the user workbook

**Files:**
- Create: `docs/testing/2026-09-06-user-collected-place-import-qa.md`

**Consumes:** the user-provided workbook and Task 1–3 code.

**Produces:** imported CloudBase records, real list/detail/AI smoke evidence, and an independent test record.

- [ ] **Step 1: Run full local verification and generate import files**

Run the full test suite, typecheck, lint, build, package check and document verification. Then invoke:

```powershell
python scripts/convert_user_collected_workbook.py --source "<user-provided-workbook>"
```

Expected: two JSON Lines files below `.local/import/`, 387 accepted rows, four category counts, and no exposed record contents in terminal output.

- [ ] **Step 2: Back up and import through the CloudBase Console**

Export `places` and `place_contents` as JSON before write. Upload the generated `place_contents.json`, then `places.json`, selecting JSON format and **Upsert** each time. If either import fails, stop and restore the already changed collection from its backup before retrying; do not claim the two imports are atomic. Do not alter environment variables, Dify keys, collection permissions, user collections, or existing indexes.

- [ ] **Step 3: Run real smoke checks**

Confirm collection counts match the report; verify one record from each category is published and has a paired detail; use the mini-program to load list, map and detail; send one `chat` request naming an imported place and verify the result contains `本地整理参考` plus the official-announcement warning. Do not record user IDs, API keys, conversation IDs, full environment IDs or raw data rows in the QA report.

- [ ] **Step 4: Independent review, QA record, and commit**

Have the security role review generated-file containment, CloudBase permissions and truth labeling. Have the independent tester rerun the relevant checks and inspect real smoke evidence. Write the QA record with exact app commit, test results, import counts, open Dify-trip blocker, and untested items. Run document verification and whitespace checks, then commit:

```powershell
git add -- docs/testing/2026-09-06-user-collected-place-import-qa.md
git commit -m "test: record user-collected place import QA"
```

## Plan self-review

- Spec coverage: Task 1 provides all-row conversion, stable IDs, two existing collections and no extra data service. Task 2 prevents user-collected material from being described as officially verified. Task 3 documents repeatable, non-secret Upsert import and recovery. Task 4 performs backup, real import, smoke tests, independent security review and QA.
- Placeholder scan: the only variable path is intentionally provided through the CLI `--source` argument; no source file path, secret, user ID or environment identifier is committed.
- Type consistency: both converter outputs use `placeId` and `_id=placeId`; the `sourceLevel` string is consumed only by retrieval and does not alter public API types or Dify credentials.
