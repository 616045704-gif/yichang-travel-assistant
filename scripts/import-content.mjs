import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadAndValidateContent } from './validate-content.mjs';

export function parseImportArguments(args) {
  const targetAt = args.indexOf('--target');
  return { target: targetAt >= 0 ? args[targetAt + 1] : undefined, apply: args.includes('--apply'), dryRun: args.includes('--dry-run') };
}

export async function planImport({ root = process.cwd(), args = process.argv.slice(2) } = {}) {
  const options = parseImportArguments(args);
  if (options.target !== 'development') throw new Error('Import target must be development.');
  if (options.apply && options.dryRun) throw new Error('Choose either --apply or --dry-run.');
  const { places, contents } = await loadAndValidateContent(root);
  return { target: options.target, mode: options.apply ? 'apply-blocked' : 'dry-run', places: places.map(item => item.placeId), contents: contents.map(item => item.placeId) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = await planImport();
  if (plan.mode === 'apply-blocked') throw new Error('No cloud administrator adapter is configured; refusing to write data. Use a controlled deployment adapter after dry-run review.');
  console.log(JSON.stringify(plan, null, 2));
}
