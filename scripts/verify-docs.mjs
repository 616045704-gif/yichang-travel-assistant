import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyDocs(root = process.cwd()) {
  const files = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.name.endsWith('.md')) files.push(name);
    }
  }
  await visit(path.join(root, 'docs/runbooks'));
  await visit(path.join(root, 'docs/testing'));
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (!/^# .+/m.test(content) || /\b(?:TODO|TBD|FIXME)\b/.test(content)) throw new Error(`Incomplete document: ${file}`);
    for (const item of content.matchAll(/^- \[([^\]\r\n]*)\](?!\()/gm)) {
      if (![' ', 'x'].includes(item[1])) throw new Error(`Invalid checklist: ${file}`);
    }
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(https?:|#)/.test(link)) continue;
      await access(path.resolve(path.dirname(file), link.split('#')[0]));
    }
  }
  return files.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Documents verified: ${await verifyDocs()}`);
}
