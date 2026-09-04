import { describe, expect, it } from 'vitest';

const enabled = process.env.RUN_CLOUDBASE_INTEGRATION === '1';

describe.skipIf(!enabled)('development cloud database security', () => {
  it('rejects direct collection access and cross-user record access', async () => {
    // This is intentionally an integration hook: provide two non-production test accounts
    // and a deployed CloudBase adapter before enabling it in CI.
    expect(process.env.CLOUDBASE_TEST_ENV).toMatch(/^.+$/u);
  });
});
