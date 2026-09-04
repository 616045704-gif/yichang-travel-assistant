import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('travel visual presentation', () => {
  it('keeps the map visible and interactive between floating filter buttons', async () => {
    const css = await readFile('miniprogram/pages/map/index.wxss', 'utf8');
    const overlay = css.match(/\.map-filters\s*\{([^}]+)\}/)![1];
    expect(overlay).toContain('background: transparent');
    expect(overlay).toContain('box-shadow: none');
    expect(overlay).toContain('border: 0');
    expect(overlay).toContain('pointer-events: none');
    const buttons = await readFile('miniprogram/components/category-filter/index.wxss', 'utf8');
    expect(buttons).toMatch(/\.filter\s*\{[^}]*pointer-events:\s*auto/);
  });
});
