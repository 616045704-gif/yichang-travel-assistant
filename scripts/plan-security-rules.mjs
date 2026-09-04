import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {{ root?: string; envId?: string }} options */
export async function planSecurityRules({ root = process.cwd(), envId } = {}) {
  if (!envId || !/^[a-z0-9-]+$/iu.test(envId)) throw new Error('Provide a CloudBase development environment ID.');
  const { rules } = JSON.parse(await readFile(path.join(root, 'database/security-rules.json'), 'utf8'));
  return rules.map(({ collection, aclTag, rule }) => ({
    Action: 'ModifySafeRule',
    Param: { CollectionName: collection, EnvId: envId, AclTag: aclTag, Rule: JSON.stringify(rule) },
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const targetAt = process.argv.indexOf('--target');
  const envId = targetAt < 0 ? undefined : process.argv[targetAt + 1];
  console.log(JSON.stringify(await planSecurityRules({ envId }), null, 2));
}
