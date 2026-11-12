import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { classify } from './release.mjs';

export const ASSET_DIR = 'augmenta-tools-assets';
export const SOURCE_FILES = Object.freeze([
  `${ASSET_DIR}/styles.css`,
  `${ASSET_DIR}/augmenta-logo-96.png`,
  `${ASSET_DIR}/augmenta-favicon-32.png`,
  'index.html',
]);
export const MARKER = 'augmenta-tools-release.json';
export const UPLOAD_FILES = Object.freeze([...SOURCE_FILES, MARKER]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function assertAllowed(path) {
  if (!UPLOAD_FILES.includes(path)) throw new Error('Path is outside the homepage allowlist.');
}

export async function safeRead(root, path) {
  assertAllowed(path);
  let current = resolve(root);
  if (!(await lstat(current)).isDirectory() || (await lstat(current)).isSymbolicLink()) throw new Error('Invalid local root.');
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) throw new Error('Links and special files are forbidden.');
  }
  const bytes = await readFile(current);
  if (bytes.length > 1024 * 1024) throw new Error('Unexpectedly large homepage file.');
  return bytes;
}

export async function verifyBundle(root) {
  const found = [];
  async function walk(prefix = '') {
    for (const entry of await readdir(join(root, prefix), {withFileTypes:true})) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error('Links are forbidden in the upload bundle.');
      if (entry.isDirectory() && name === ASSET_DIR) await walk(name);
      else { assertAllowed(name); found.push(name); }
    }
  }
  await walk();
  if (found.length !== UPLOAD_FILES.length) throw new Error('Incomplete upload bundle.');
  const files = new Map();
  for (const path of UPLOAD_FILES) files.set(path, await safeRead(root, path));
  const manifest = JSON.parse(files.get(MARKER));
  if (manifest.channel !== classify(manifest.version) || !/^[a-f0-9]{40}$/.test(manifest.commit)) throw new Error('Invalid release identity.');
  if (JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify([...SOURCE_FILES].sort())) throw new Error('Manifest does not match allowlist.');
  for (const path of SOURCE_FILES) if (manifest.files[path] !== sha256(files.get(path))) throw new Error('Bundle checksum mismatch.');
  return {files, manifest};
}

export async function build(root, out, version, commit) {
  const manifest = {version, channel:classify(version), commit, files:{}};
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid commit.');
  for (const path of SOURCE_FILES) {
    const bytes = await safeRead(root, path);
    manifest.files[path] = sha256(bytes);
    await mkdir(dirname(join(out, path)), {recursive:true});
    await writeFile(join(out, path), bytes);
  }
  await writeFile(join(out, MARKER), JSON.stringify(manifest, null, 2) + '\n');
  await verifyBundle(out);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await build('.', 'dist', process.env.RELEASE_TAG || '0.0.0b1', process.env.GITHUB_SHA || execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim());
  console.log(`Built ${UPLOAD_FILES.length} explicitly allowlisted files.`);
}
