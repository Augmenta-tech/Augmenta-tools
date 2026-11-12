import { MARKER, SOURCE_FILES, sha256 } from './site.mjs';

export const SITE_URLS = Object.freeze({beta:'https://beta.tools.augmenta.tech',stable:'https://tools.augmenta.tech'});

export async function fetchBytes(url) {
  const response = await fetch(url, {redirect:'error',signal:AbortSignal.timeout(30000),cache:'no-store'});
  if (!response.ok) throw new Error('Public HTTPS verification failed.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1024 * 1024) throw new Error('Unexpected public response size.');
  return bytes;
}

export async function verifyPublic(base, manifest, requireMarker = true) {
  if (!Object.values(SITE_URLS).includes(base)) throw new Error('Unexpected public origin.');
  for (const path of SOURCE_FILES) {
    const bytes = await fetchBytes(`${base}/${path}?verify=${manifest.commit}`);
    if (sha256(bytes) !== manifest.files[path]) throw new Error('Public file checksum mismatch.');
  }
  if (requireMarker) {
    const marker = JSON.parse(await fetchBytes(`${base}/${MARKER}?verify=${manifest.commit}`));
    if (JSON.stringify(marker) !== JSON.stringify(manifest)) throw new Error('Public release marker mismatch.');
  }
}

export async function requireVerifiedBeta(stable) {
  const beta = JSON.parse(await fetchBytes(`${SITE_URLS.beta}/${MARKER}?verify=${stable.commit}`));
  if (beta.channel !== 'beta' || !new RegExp(`^${stable.version.replaceAll('.', '\\.')}b[0-9]+$`).test(beta.version)
      || beta.commit !== stable.commit || JSON.stringify(beta.files) !== JSON.stringify(stable.files)) {
    throw new Error('Stable must promote the identical commit and files from a matching verified beta.');
  }
  await verifyPublic(SITE_URLS.beta, beta);
}
