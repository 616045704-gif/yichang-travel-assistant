import path from 'node:path';

export function resolveBuildOutput(root, mode) {
  if (!['development', 'demo'].includes(mode)) throw new Error('Invalid build mode');
  return path.join(path.resolve(root), mode === 'demo' ? 'dist' : 'dist-dev');
}
