import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function classify(tag) {
  if (/^[0-9]+\.[0-9]+\.[0-9]+b[0-9]+$/.test(tag)) return 'beta';
  if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(tag)) return 'stable';
  throw new Error('Invalid release tag; expected x.y.zbN or x.y.z.');
}

export function eventChannel(event, refType, tag) {
  return event === 'push' && refType === 'tag' ? classify(tag) : '';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const channel = eventChannel(process.env.GITHUB_EVENT_NAME, process.env.GITHUB_REF_TYPE, process.env.GITHUB_REF_NAME);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `channel=${channel}\n`);
  console.log(channel ? `Release channel: ${channel}` : 'Validation only; no deployment.');
}
