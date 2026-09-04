import { describe, expect, it } from 'vitest';

const enabled = process.env.RUN_CLOUDBASE_INTEGRATION === '1';

describe.skipIf(!enabled)('development cloud database security', () => {
  it('rejects direct collection access and cross-user record access', async () => {
    // A real adapter is deliberately required: enabling this suite without it fails,
    // rather than reporting a false green result from environment variables alone.
    const adapterPath = process.env.CLOUDBASE_SECURITY_ADAPTER;
    expect(adapterPath, 'Set CLOUD_BASE_SECURITY_ADAPTER to the verified development-cloud adapter.').toMatch(/^.+$/u);
    const adapter = await import(adapterPath!);
    await adapter.assertDirectAccessDenied();
    await adapter.assertCrossUserRecordsDenied();
    await adapter.assertPlaceStorageWriteDenied();
  });
});
