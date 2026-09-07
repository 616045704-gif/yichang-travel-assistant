import { readdir, readFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function listFiles(root) {
  const result = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, item.name);
    if (item.isSymbolicLink()) throw new Error(`Symlink not allowed: ${file}`);
    if (item.isDirectory()) result.push(...await listFiles(file));
    else result.push(file);
  }
  return result;
}

function localPath(root, name) {
  const value = path.resolve(root, name.replace(/^\//, ''));
  if (!value.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Invalid resource path: ${name}`);
  return value;
}

export async function validateResources(root, extension = 'js') {
  const app = JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8'));
  if (!Array.isArray(app.pages) || !app.pages.length) throw new Error('Missing pages');
  for (const page of app.pages) {
    for (const ext of [extension, 'json', 'wxml', 'wxss']) await access(localPath(root, `${page}.${ext}`));
  }
  for (const tab of app.tabBar?.list || []) {
    if (!app.pages.includes(tab.pagePath)) throw new Error(`Invalid tab route: ${tab.pagePath}`);
    for (const key of ['iconPath', 'selectedIconPath']) if (tab[key]) await access(localPath(root, tab[key]));
  }
  if (app.sitemapLocation) await access(localPath(root, app.sitemapLocation));
  for (const file of await listFiles(root)) {
    if (file.endsWith('.json')) {
      const config = JSON.parse(await readFile(file, 'utf8'));
      for (const component of Object.values(config.usingComponents || {})) {
        const base = component.startsWith('/') ? localPath(root, component) : localPath(root, path.relative(root, path.resolve(path.dirname(file), component)));
        for (const ext of [extension, 'json', 'wxml', 'wxss']) await access(`${base}.${ext}`);
      }
    }
    if (file.endsWith('.wxss')) {
      const css = await readFile(file, 'utf8');
      for (const match of css.matchAll(/@import\s+["']([^"']+)["']/g)) await access(localPath(root, path.relative(root, path.resolve(path.dirname(file), match[1]))));
    }
  }
}

export async function checkPackage({ root = process.cwd(), mode = 'development' } = {}) {
  const client = path.join(root, 'dist/miniprogram');
  await validateResources(client);
  const files = await listFiles(client);
  const bytes = (await Promise.all(files.map(async file => (await stat(file)).size))).reduce((total, size) => total + size, 0);
  if (bytes > 1_900_000) throw new Error(`Mini-program main package exceeds 1.9 MB budget: ${bytes} B`);
  for (const file of files) {
    const relative = path.relative(client, file).replaceAll('\\', '/');
    if (/\.(ts|map|md)$|(^|\/)(tests|cloudfunctions|node_modules|secrets)\//.test(relative)) throw new Error(`Forbidden package resource: ${relative}`);
    if (mode === 'demo' && /(^|[/.\-_])(mock|fixtures?|tests?)([/.\-_]|$)/i.test(relative)) throw new Error(`Mock in demo: ${relative}`);
    if (!/\.(js|json|wxml|wxss|wxs)$/.test(file)) continue;
    const code = await readFile(file, 'utf8');
    if (/DIFY_[A-Z0-9_]+|api\.dify\.|authorization\s*[:=]\s*[`'"]?bearer|\/v1\/chat-messages|wx-server-sdk|\bwx\.request\s*\(|-----BEGIN .*PRIVATE KEY/i.test(code)) throw new Error(`Client boundary violation: ${relative}`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkPackage();
  console.log('Client routes, resources and boundary verified');
}
