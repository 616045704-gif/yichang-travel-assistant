# Featured Place Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add traceable, license-cleared cover images to a four-category featured subset of the existing CloudBase place collection, then verify that the database-backed list, detail, and map projections remain consistent.

**Architecture:** Retain all existing 387 imported place and detail documents without overwriting them. A locally versioned manifest contains only selected place IDs and image provenance metadata; a management-only uploader validates the manifest and produces a count-only upload plan. A CloudBase administrator performs approved uploads and targeted `coverFileId` updates, while the existing `placeService` continues to supply list, details, and markers from the database.

**Tech Stack:** Node.js 22, TypeScript, Vitest, CloudBase Console, Wikimedia Commons image-description pages, existing CloudBase `placeService`.

## Global Constraints

- Do not read, write, print, commit, or request Dify credentials, CloudBase credentials, environment files, user identifiers, or location history.
- Keep all existing `places` and `place_contents` records; no deletion, replacement, collection permission change, or Dify change is in scope.
- Select 20–30 representative records across `scenic`, `restaurant`, `culture`, and `camping`; selected records remain `sourceLevel: "user_collected"` unless their evidence is independently upgraded.
- Every remote image must have an exact Wikimedia Commons file-description URL, author, license identifier, attribution text, and matching place ID. Do not use photos copied from other mini-programs or an official site with unclear reuse rights.
- Upload files only through the approved CloudBase management flow. Store only the returned `cloud://` file ID in a matching place document and record the file ID in the image manifest after upload.
- Preserve the existing database-only list/detail/map/AI path. Do not hard-code place content or image URLs in mini-program pages.

---

### Task 1: Add a testable featured-image manifest and validator

**Files:**
- Create: `content/featured-place-images.json`
- Create: `scripts/validate-featured-images.mjs`
- Create: `tests/unit/featured-image-manifest.test.ts`

**Interfaces:**
- Consumes: an array of records with `placeId`, `category`, `commonsFilePage`, `author`, `license`, `attribution`, `cloudFileId`, and `verifiedAt`.
- Produces: `validateFeaturedImages(records): string[]`, returning field-specific errors and no remote image bytes.

- [ ] **Step 1: Write the failing manifest test**

```ts
import { expect, it } from 'vitest';
import { validateFeaturedImages } from '../../scripts/validate-featured-images.mjs';

it('requires a Commons file page, attribution, license, cloud file ID and four categories', () => {
  const errors = validateFeaturedImages([{ placeId: 'place-a', category: 'scenic' }]);
  expect(errors.join('\n')).toMatch(/commonsFilePage|author|license|attribution|cloudFileId|verifiedAt/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/featured-image-manifest.test.ts`

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement the minimal manifest validator**

```js
const CATEGORIES = new Set(['scenic', 'restaurant', 'culture', 'camping']);
const COMMONS_FILE = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/u;
const CLOUD_FILE = /^cloud:\/\/[A-Za-z0-9._-]+\/.+/u;

export function validateFeaturedImages(records) {
  const errors = [];
  const ids = new Set();
  for (const item of records) {
    if (!item?.placeId || ids.has(item.placeId)) errors.push('placeId must be unique');
    ids.add(item?.placeId);
    if (!CATEGORIES.has(item?.category)) errors.push(`${item?.placeId}.category`);
    for (const key of ['author', 'license', 'attribution']) if (typeof item?.[key] !== 'string' || !item[key].trim()) errors.push(`${item?.placeId}.${key}`);
    if (!COMMONS_FILE.test(item?.commonsFilePage ?? '')) errors.push(`${item?.placeId}.commonsFilePage`);
    if (!CLOUD_FILE.test(item?.cloudFileId ?? '')) errors.push(`${item?.placeId}.cloudFileId`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(item?.verifiedAt ?? '')) errors.push(`${item?.placeId}.verifiedAt`);
  }
  return errors;
}
```

- [ ] **Step 4: Add the final manifest only after approved uploads return file IDs**

Include 20–30 entries matching existing CloudBase IDs, at least one entry in every category. Do not invent `cloudFileId` values: retain a locally ignored staging manifest until the management console returns real IDs.

- [ ] **Step 5: Run focused validation and commit**

Run:
```powershell
node node_modules/vitest/vitest.mjs run tests/unit/featured-image-manifest.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

Commit:
```powershell
git add -- scripts/validate-featured-images.mjs tests/unit/featured-image-manifest.test.ts content/featured-place-images.json
git commit -m "feat: validate featured place image provenance"
```

### Task 2: Apply approved CloudBase image updates without changing other records

**Files:**
- Modify: `content/featured-place-images.json`
- Modify: `content/source-register.md`

**Interfaces:**
- Consumes: validated local manifest and actual selected documents from CloudBase `places`.
- Produces: one cover `cloud://` ID per selected place, with matching source-register provenance.

- [ ] **Step 1: Re-run read-only CloudBase inventory**

In CloudBase Console, read only `places`, `place_contents`, and selected cloud-storage objects. Record only totals, category coverage, missing covers, source/verification completeness and selected record IDs; do not expose raw documents, environment identifiers or credentials.

- [ ] **Step 2: Build an upload manifest from license-cleared image pages**

For each selected place, record the exact Commons `File:` page, author, license, attribution, and source-review time. Reject any image whose page does not show a reuse license or whose subject does not match the selected place.

- [ ] **Step 3: Upload and make targeted updates**

Upload each validated image to CloudBase storage, copy its returned `cloud://` file ID into the corresponding `places.coverFileId`, and update no other place fields. Do not edit collection permissions, functions, environment variables, or `place_contents` unless a supplemental image section is explicitly selected.

- [ ] **Step 4: Validate database consistency in the console**

For every selected ID, confirm the document remains `published`, retains its original category and GCJ-02 coordinate, has a paired detail, and references the returned storage file ID. Confirm no unselected record changed.

- [ ] **Step 5: Commit provenance documentation**

Run `npm run verify:docs` and `git diff --check`, then commit only the manifest and source register.

### Task 3: Test database-backed list, detail, and map consistency

**Files:**
- Modify: `tests/unit/place-service.test.ts`
- Modify: `tests/unit/place-storage.test.ts`
- Create: `docs/testing/2026-09-06-featured-place-covers-qa.md`

**Interfaces:**
- Consumes: a published place fixture with an authorized `cloud://` cover, a paired detail, and a valid GCJ-02 coordinate.
- Produces: unit evidence that the list resolves the cover, detail returns the same place, and map markers retain matching ID and coordinate.

- [ ] **Step 1: Add failing cross-surface test**

```ts
it('keeps a published covered place consistent between list, detail and marker projections', async () => {
  const repository = createPlaceRepository(databaseWithCoveredPlace());
  const listed = (await repository.list({})).items[0];
  const detail = await repository.detail(listed.placeId);
  const marker = (await repository.markers()).find(item => item.placeId === listed.placeId);
  expect(detail).toMatchObject({ placeId: listed.placeId, coverFileId: listed.coverFileId });
  expect(marker).toMatchObject({ placeId: listed.placeId, latitude: listed.latitude, longitude: listed.longitude });
});
```

- [ ] **Step 2: Run focused tests**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/place-service.test.ts tests/unit/place-storage.test.ts`

Expected: PASS after preserving existing repository projection behavior; if it fails, correct only the projection defect exposed by the test.

- [ ] **Step 3: Run all relevant local checks**

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run check:package
npm run verify:docs
git diff --check
```

Expected: PASS, except the explicitly environment-dependent integration test may remain skipped.

- [ ] **Step 4: Record independent acceptance**

In `docs/testing/2026-09-06-featured-place-covers-qa.md`, record tested commit, commands, totals only, source/license checks, console observations, defects, and untested WeChat/Android/iPhone items. Do not claim real smoke or independent tester pass without actual evidence.

- [ ] **Step 5: Commit tests and QA record**

```powershell
git add -- tests/unit/place-service.test.ts tests/unit/place-storage.test.ts
git commit -m "test: cover featured place projection consistency"
git add -- docs/testing/2026-09-06-featured-place-covers-qa.md
git commit -m "test: record featured place covers QA"
```

## Plan self-review

- Spec coverage: Task 1 gives license and file-ID validation; Task 2 makes only approved cover-field changes and maintains provenance; Task 3 verifies list, detail and map share database-backed identities and creates an honest acceptance record.
- Placeholder scan: all exact files, fields, validation rules, commands and commit boundaries are defined; actual file IDs are intentionally deferred until CloudBase returns them.
- Type consistency: `cloudFileId` is manifest-only while `coverFileId` is the existing CloudBase and service field; both require the same `cloud://` form.

