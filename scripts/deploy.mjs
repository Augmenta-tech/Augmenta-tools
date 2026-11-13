import { Client } from 'basic-ftp';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { ASSET_DIR, UPLOAD_FILES, verifyBundle } from './site.mjs';
import { SITE_URLS, verifyPublic, requireVerifiedBeta } from './verify.mjs';

export function connectionOptions(env, channel) {
  if (env.FTP_REMOTE_DIR !== '/' || env.SITE_URL !== SITE_URLS[channel]) throw new Error('Environment root or website mismatch.');
  if (!/^[a-zA-Z0-9.-]+$/.test(env.FTP_HOST || '') || !env.FTP_HOST.includes('.')) throw new Error('Invalid FTPS hostname.');
  if (!env.FTP_USER?.includes('@') || !env.FTP_PASSWORD || /[\r\n\0]/.test(env.FTP_USER + env.FTP_PASSWORD)) throw new Error('Missing or invalid environment credentials.');
  return {host:env.FTP_HOST,port:21,user:env.FTP_USER,password:env.FTP_PASSWORD,secure:true,
    secureOptions:{rejectUnauthorized:true,minVersion:'TLSv1.2',servername:env.FTP_HOST}};
}

export async function preflightRemote(client, progress = () => {}) {
  // The account itself must be jailed to the website root. Never accept an account-wide path.
  progress('checking account confinement');
  if (await client.pwd() !== '/') throw new Error('FTP account is not at its restricted root.');
  progress('listing root through encrypted data connection');
  const root = await client.list();
  const assets = root.find(item => item.name === ASSET_DIR);
  if (assets && (!assets.isDirectory || assets.isSymbolicLink)) throw new Error('Unsafe remote asset directory.');
  progress('checking allowlisted destinations');
  const listing = assets ? await client.list(ASSET_DIR) : [];
  // Check every destination before performing any writes; ignore unrelated server-owned entries.
  for (const path of UPLOAD_FILES) {
    const name = path.split('/').at(-1);
    const existing = (path.includes('/') ? listing : root).find(item => item.name === name);
    if (existing && (!existing.isFile || existing.isSymbolicLink)) throw new Error('Unsafe remote file destination.');
  }
  return Boolean(assets);
}

export async function uploadBundle(client, bundle, progress = () => {}) {
  const exists = await preflightRemote(client, progress);
  progress('creating asset directory if needed');
  if (!exists) await client.send(`MKD ${ASSET_DIR}`);
  // Buffers were validated before login, preventing local file changes during upload.
  // Upload assets first, then index, then the release marker. Never delete or mirror anything.
  for (const path of UPLOAD_FILES) {
    progress(`uploading ${path}`);
    await client.uploadFrom(Readable.from(bundle.files.get(path)), path);
  }
}

let stage = 'validating local release';
function progress(value) { stage = value; console.log(`Deployment: ${stage}.`); }

async function main() {
  const bundle = await verifyBundle('dist');
  if (bundle.manifest.version !== process.env.RELEASE_TAG || bundle.manifest.commit !== process.env.GITHUB_SHA) throw new Error('Release identity mismatch.');
  const {channel} = bundle.manifest;
  const options = connectionOptions(process.env, channel);
  if (channel === 'stable') await requireVerifiedBeta(bundle.manifest);
  const client = new Client(30000, {allowSeparateTransferHost:false,maxListingBytes:1024*1024});
  try {
    progress('connecting and authenticating with verified FTPS');
    await client.access(options);
    progress('checking control connection certificate');
    if (!client.ftp.socket.encrypted || client.ftp.socket.authorized !== true) throw new Error('FTPS certificate validation required.');
    // The library tolerates some setup errors; explicitly require encrypted data transfers here.
    progress('requiring encrypted data transfers');
    await client.send('PBSZ 0');
    await client.send('PROT P');
    await uploadBundle(client, bundle, progress);
  } finally { client.close(); }
  progress('verifying public HTTPS files');
  await verifyPublic(SITE_URLS[channel], bundle.manifest);
  console.log(`Verified ${UPLOAD_FILES.length} homepage files over HTTPS for ${bundle.manifest.version}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Do not print server replies, credentials, or environment configuration in public logs.
    const knownCodes = ['ENOTFOUND','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','DEPTH_ZERO_SELF_SIGNED_CERT'];
    const category = Number.isInteger(error.code) ? `FTP ${error.code}` : knownCodes.includes(error.code) ? error.code : 'error';
    console.error(`Deployment failed while ${stage} (${category}). No credentials or server replies are logged.`);
    process.exitCode = 1;
  });
}
