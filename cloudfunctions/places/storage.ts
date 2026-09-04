import type { PlaceSummary } from '../../shared/contracts';
import type { PlaceSection } from '../../shared/contracts';

type Storage = { getTempFileURL(input: { fileList: string[] }): Promise<{ fileList: Array<{ fileID: string; tempFileURL?: string }> }> };

export async function resolveCoverUrls(items: PlaceSummary[], storage: Storage): Promise<PlaceSummary[]> {
  const fileList = [...new Set(items.flatMap(item => item.coverFileId ? [item.coverFileId] : []))];
  if (!fileList.length) return items;
  const urls = new Map((await storage.getTempFileURL({ fileList })).fileList.map(file => [file.fileID, file.tempFileURL || null]));
  return items.map(item => ({ ...item, coverUrl: item.coverFileId ? urls.get(item.coverFileId) || null : null }));
}

export async function resolveSectionImageUrls(sections: PlaceSection[], storage: Storage): Promise<PlaceSection[]> {
  const fileList = [...new Set(sections.flatMap(section => section.type === 'image' ? [section.fileId] : []))];
  if (!fileList.length) return sections;
  const urls = new Map((await storage.getTempFileURL({ fileList })).fileList.map(file => [file.fileID, file.tempFileURL || null]));
  return sections.map(section => section.type === 'image' ? { ...section, url: urls.get(section.fileId) || null } : section);
}
