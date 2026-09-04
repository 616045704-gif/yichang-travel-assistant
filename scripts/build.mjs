import { access, mkdir, readFile, writeFile, readdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { checkPackage, listFiles, validateResources } from './check-package.mjs';

async function readOptional(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function buildProject({ root = process.cwd(), mode = 'development' } = {}) {
  root = path.resolve(root);
  if (!['development', 'demo'].includes(mode)) throw new Error('Invalid build mode');
  const source = path.join(root, 'miniprogram');
  const output = path.join(root, 'dist');
  await access(path.join(source, 'app.ts'));
  await validateResources(source, 'ts');
  const local = await readOptional(path.join(root, 'config/local.json'), {});
  if (Object.keys(local).some(key => !['appid', 'cloudEnv'].includes(key))) throw new Error('Unexpected local config field');
  if (local.appid && !/^(wx[a-f0-9]{16}|touristappid)$/.test(local.appid)) throw new Error('Invalid AppID');
  if (local.cloudEnv && (typeof local.cloudEnv !== 'string' || !/^[a-zA-Z0-9-]+$/.test(local.cloudEnv))) throw new Error('Invalid cloud environment');
  // Keep the IDE's imported directory openable on Windows; only replace generated children.
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unsafe output path');
  await mkdir(output, { recursive: true });
  for (const item of await readdir(output, { withFileTypes: true })) {
    if (item.name === 'project.private.config.json' && item.isFile()) continue;
    const generatedPath = path.resolve(output, item.name);
    if (path.dirname(generatedPath) !== output) throw new Error('Unsafe generated path');
    await rm(generatedPath, { recursive: true, force: true });
  }
  await mkdir(path.join(output, 'miniprogram'), { recursive: true });
  await mkdir(path.join(output, 'cloudfunctions'), { recursive: true });
  const files = await listFiles(source);
  const entries = files.filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));
  const boundary = {
    name: 'client-boundary',
    setup(builder) {
      builder.onLoad({ filter: /.*/ }, async ({ path: file }) => {
        const relative = path.relative(root, file).replaceAll('\\', '/');
        if (!/^(miniprogram|shared)\//.test(relative)) throw new Error(`Client boundary: ${relative}`);
        if (mode === 'demo' && /(^|[/.\-_])(mock|fixtures?|tests?)([/.\-_]|$)/i.test(relative)) throw new Error(`Mock excluded from demo: ${relative}`);
        const text = await readFile(file, 'utf8');
        if (/api\.dify\.|DIFY_API_KEY|\bwx\.request\s*\(/i.test(text)) throw new Error(`Client boundary: external API request in ${relative}`);
        const loaders = { '.ts': 'ts', '.js': 'js', '.json': 'json' };
        const loader = loaders[path.extname(file)];
        if (!loader) throw new Error(`Client boundary: unsupported module ${relative}`);
        return { contents: text, loader };
      });
    },
  };
  await build({
    absWorkingDir: root, entryPoints: entries, outbase: source, outdir: path.join(output, 'miniprogram'),
    bundle: true, platform: 'neutral', format: 'cjs', target: 'es2018', logLevel: 'silent',
    define: { __CLOUD_ENV__: JSON.stringify(local.cloudEnv || ''), __BUILD_MODE__: JSON.stringify(mode) },
    plugins: [boundary],
  });
  for (const file of files.filter(file => /\.(json|wxml|wxss|wxs|png|jpg|jpeg|svg)$/.test(file))) {
    const target = path.join(output, 'miniprogram', path.relative(source, file));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file, target);
  }
  const cloudRoot = path.join(root, 'cloudfunctions');
  const cloudFolders = await readdir(cloudRoot, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  for (const folder of cloudFolders.filter(entry => entry.isDirectory())) {
    const entry = path.join(cloudRoot, folder.name, 'index.ts');
    try { await access(entry); } catch { continue; }
    const target = path.join(output, 'cloudfunctions', folder.name);
    const manifest = await readOptional(path.join(cloudRoot, folder.name, 'package.json'), {});
    const dependencies = manifest.dependencies || {};
    await build({ entryPoints: [entry], outfile: path.join(target, 'index.js'), bundle: true, platform: 'node', format: 'cjs', target: 'node18', external: Object.keys(dependencies), logLevel: 'silent' });
    await writeFile(path.join(target, 'package.json'), JSON.stringify({ name: folder.name.toLowerCase(), version: '0.1.0', main: 'index.js', dependencies }, null, 2));
  }
  const project = JSON.parse(await readFile(path.join(root, 'project.config.json'), 'utf8'));
  await writeFile(path.join(output, 'project.config.json'), JSON.stringify({ ...project, appid: local.appid || project.appid, miniprogramRoot: 'miniprogram/', cloudfunctionRoot: 'cloudfunctions/' }, null, 2));
  await checkPackage({ root, mode });
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'development';
  await buildProject({ mode });
  console.log(`Build ready: dist/ (${mode})`);
}
