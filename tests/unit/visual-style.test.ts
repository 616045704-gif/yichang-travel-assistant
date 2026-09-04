import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('travel visual presentation', () => {
  it('ships the paper theme consistently with native navigation and original assets', async () => {
    const tokens = await readFile('miniprogram/styles/tokens.wxss', 'utf8');
    const app = JSON.parse(await readFile('miniprogram/app.json', 'utf8'));
    expect(tokens).toContain('--color-background: #f5eddf');
    expect(tokens).toContain('--color-accent: #a44d3e');
    expect(app.window.navigationBarBackgroundColor.toLowerCase()).toBe('#f5eddf');
    expect(app.tabBar.selectedColor.toLowerCase()).toBe('#a44d3e');
    const home = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
    expect(home).toContain('/assets/illustrations/yichang-ink.jpg');
    const art = await readFile('miniprogram/assets/illustrations/yichang-ink.jpg');
    expect(art.subarray(0, 2).toString('hex')).toBe('ffd8');
    expect(art.length).toBeLessThan(350_000);
    for (const category of ['scenic', 'restaurant', 'culture', 'camping']) {
      expect((await readFile(`miniprogram/assets/icons/category-${category}.png`)).subarray(1, 4).toString()).toBe('PNG');
    }
  });
  it('renders separate AI chat and trip entry cards with the disclaimer in the themed home', async () => {
    const home = await readFile('miniprogram/pages/home/index.wxml', 'utf8');
    const homeStyle = await readFile('miniprogram/pages/home/index.wxss', 'utf8');
    const chat = await readFile('miniprogram/pages/ai-chat/index.wxml', 'utf8');
    expect(home).toContain('自由问答');
    expect(home).toContain('行程定制');
    expect(home).toContain('bindtap="openAiChat"');
    expect(home).toContain('bindtap="openTripForm"');
    expect(homeStyle).toContain('.ai-entry-grid');
    expect(homeStyle).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(chat).not.toContain('我要定制行程');
    expect(chat).not.toContain('bindtap="openTripForm"');
    expect(home).toContain('内容仅供出行参考，请以景区、交通等官方公告为准');
    expect(home).toContain('status="empty"');
    expect(home).toContain('bindtap="openDiscover"');
    for (const feature of ['景点预约', '住宿预订', '活动日历']) expect(home).not.toContain(feature);
  });
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
