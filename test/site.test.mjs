import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { parseDocument } from 'yaml';
import { classify, eventChannel } from '../scripts/release.mjs';
import { UPLOAD_FILES, build, verifyBundle, safeRead, assertAllowed } from '../scripts/site.mjs';
import { connectionOptions, uploadBundle } from '../scripts/deploy.mjs';
import { SITE_URLS, verifyPublic, requireVerifiedBeta } from '../scripts/verify.mjs';

const root=resolve('.');
const {document}=parseHTML(await readFile('index.html','utf8'));
const css=await readFile('augmenta-tools-assets/styles.css','utf8');
const commit='a'.repeat(40);
async function scratch(t) {
  const path=await mkdtemp(join(tmpdir(),'augmenta-tools-'));
  t.after(()=>rm(path,{recursive:true,force:true}));return path;
}

test('approved hero and exactly four illustrated cards retain their destinations',()=>{
  assert.equal(document.querySelectorAll('h1').length,1);
  assert.match(document.querySelector('h1').textContent,/Tools for/);
  const cards=[...document.querySelectorAll('.grid > .tool')];
  assert.equal(cards.length,4);
  assert.deepEqual(cards.map(c=>c.querySelector('h2').textContent),['Audit tool','Augmenta Web Receiver','Augmenta Three.js Example','Augmenta MCP Server']);
  assert.deepEqual(cards.map(c=>c.getAttribute('href')),['https://tools.augmenta.tech/audit','https://augmenta-tech.github.io/Augmenta-ThreeJS-example/','https://augmenta-tech.github.io/Augmenta-ThreeJS-example/',null]);
  assert.equal(cards[3].tagName,'ARTICLE');assert.match(cards[3].textContent,/COMING SOON/);
  for(const card of cards) assert.ok(card.querySelector('.art svg[role="img"][aria-label]'));
});

test('local official assets, accessible landmarks, focus and reduced motion',async()=>{
  assert.equal(document.documentElement.getAttribute('lang'),'en');
  assert.equal(document.querySelector('meta[name="viewport"]').getAttribute('content'),'width=device-width, initial-scale=1');
  assert.ok(document.querySelector('main#main'));
  assert.equal(document.querySelector('.skip-link').getAttribute('href'),'#main');
  assert.equal(document.querySelectorAll('script,iframe,form,style').length,0);
  for(const img of document.querySelectorAll('img')) {
    assert.ok(img.hasAttribute('alt'));assert.equal(img.getAttribute('src'),'augmenta-tools-assets/augmenta-logo-96.png');
  }
  assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/@media\(max-width:650px\)/);assert.doesNotMatch(css,/@import|url\(|\.inactive\{opacity/);
  for(const asset of ['augmenta-logo-96.png','augmenta-favicon-32.png']) {
    const bytes=await readFile(`augmenta-tools-assets/${asset}`);const size=asset.includes('96')?96:32;
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
  }
});

test('exact release classification; commits and PRs never deploy',()=>{
  for(const tag of ['0.0.0b1','1.2.3b12','12.10.3b0']) assert.equal(classify(tag),'beta');
  for(const tag of ['0.0.0','1.2.3','12.10.3']) assert.equal(classify(tag),'stable');
  for(const tag of ['v1.2.3','1.2','1.2.3-beta1','1.2.3b','1.2.3b1extra','1.2.3\n','1.2.3/evil',' 1.2.3']) assert.throws(()=>classify(tag));
  for(const [event,type] of [['push','branch'],['pull_request','tag'],['workflow_dispatch','tag']]) assert.equal(eventChannel(event,type,'1.2.3'),'');
  assert.equal(eventChannel('push','tag','1.2.3b1'),'beta');assert.throws(()=>eventChannel('push','tag','anything'));
});

test('exact allowlist excludes applications, configuration and traversal',()=>{
  assert.deepEqual(UPLOAD_FILES,['augmenta-tools-assets/styles.css','augmenta-tools-assets/augmenta-logo-96.png','augmenta-tools-assets/augmenta-favicon-32.png','index.html','augmenta-tools-release.json']);
  for(const path of ['.htaccess','.env','.git/config','audit/index.html','factory-audit/index.html','../index.html','/index.html','augmenta-tools-assets/../index.html','augmenta-tools-assets\\styles.css','augmenta-tools-assets/extra.ico','augmenta-tools-assets/extra.png','index.html\r\nDELE x']) assert.throws(()=>assertAllowed(path));
});

test('bundle detects extra files, corruption and invalid identities',async t=>{
  const out=await scratch(t);await build(root,out,'1.0.0b1',commit);
  assert.equal((await verifyBundle(out)).files.size,5);
  await writeFile(join(out,'.env'),'not-a-secret');await assert.rejects(()=>verifyBundle(out));await rm(join(out,'.env'));
  await writeFile(join(out,'index.html'),'changed');await assert.rejects(()=>verifyBundle(out),/checksum/);
  await assert.rejects(()=>build(root,out,'v1.0.0',commit));
});

test('local directory links cannot enter the upload bundle',async t=>{
  const out=await scratch(t);
  await symlink(join(root,'augmenta-tools-assets'),join(out,'augmenta-tools-assets'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>safeRead(out,'augmenta-tools-assets/styles.css'),/Links/);
  await assert.rejects(()=>verifyBundle(out),/Links/);
});

test('FTPS requires certificate validation, restricted root and correct website',()=>{
  const env={FTP_HOST:'ftp.example.com',FTP_USER:'beta@example.com',FTP_PASSWORD:'test-only',FTP_REMOTE_DIR:'/',SITE_URL:SITE_URLS.beta};
  const options=connectionOptions(env,'beta');assert.equal(options.secure,true);assert.equal(options.port,21);
  assert.equal(options.secureOptions.rejectUnauthorized,true);assert.equal(options.secureOptions.minVersion,'TLSv1.2');
  for(const bad of [{FTP_REMOTE_DIR:'/public_html/'},{SITE_URL:SITE_URLS.stable},{FTP_PASSWORD:''},{FTP_USER:'admin'},{FTP_HOST:'host/other'},{FTP_PASSWORD:'x\nPASS y'}]) assert.throws(()=>connectionOptions({...env,...bad},'beta'));
});

const file=name=>({name,isFile:true,isDirectory:false,isSymbolicLink:false});
const dir=name=>({name,isFile:false,isDirectory:true,isSymbolicLink:false});
const link=name=>({name,isFile:false,isDirectory:false,isSymbolicLink:true});
function fakeClient(rootEntries=[],assetEntries=[],pwd='/') {
  const writes=[];return {writes,pwd:async()=>pwd,list:async path=>path?assetEntries:rootEntries,
    send:async command=>writes.push(command),uploadFrom:async(stream,path)=>{for await(const _ of stream){} writes.push(path);}};
}

test('unsafe remote destinations fail before any writes',async t=>{
  const out=await scratch(t);await build(root,out,'1.0.0b1',commit);const bundle=await verifyBundle(out);
  for(const client of [fakeClient([link('augmenta-tools-assets')]),fakeClient([link('index.html')]),fakeClient([dir('augmenta-tools-assets')],[link('styles.css')]),fakeClient([dir('index.html')]),fakeClient([],[],'/home/account')]) {
    await assert.rejects(()=>uploadBundle(client,bundle));assert.deepEqual(client.writes,[]);
  }
});

test('only five files upload; unrelated applications and routing are untouched',async t=>{
  const out=await scratch(t);await build(root,out,'1.0.0b1',commit);const bundle=await verifyBundle(out);
  const client=fakeClient([link('factory-audit'),dir('audit'),file('.htaccess')]);
  await uploadBundle(client,bundle);assert.deepEqual(client.writes,['MKD augmenta-tools-assets',...UPLOAD_FILES]);
  const existing=fakeClient([dir('augmenta-tools-assets'),file('index.html')],[file('styles.css'),file('unrelated.png')]);
  await uploadBundle(existing,bundle);assert.deepEqual(existing.writes,[...UPLOAD_FILES]);
});

test('public checks reject corruption; stable requires identical matching beta',async t=>{
  const out=await scratch(t);const beta=await build(root,out,'1.0.0b1',commit);const bundle=await verifyBundle(out);
  const stable={...beta,version:'1.0.0',channel:'stable'};let corrupt=false;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(options.redirect,'error');assert.ok(url.startsWith(SITE_URLS.beta+'/'));
    const name=new URL(url).pathname.slice(1);
    return new Response(corrupt&&name==='index.html'?'tampered':bundle.files.get(name),{status:200});
  });
  await requireVerifiedBeta(stable);
  await assert.rejects(()=>requireVerifiedBeta({...stable,commit:'b'.repeat(40)}),/identical/);
  await assert.rejects(()=>requireVerifiedBeta({...stable,version:'2.0.0'}),/identical/);
  corrupt=true;await assert.rejects(()=>verifyPublic(SITE_URLS.beta,beta),/checksum/);
});

test('workflow syntax, pinned actions and tag-only protected deployments',async()=>{
  const parsed=parseDocument(await readFile('.github/workflows/validate-and-deploy.yml','utf8'),{uniqueKeys:true});
  assert.deepEqual(parsed.errors,[]);const w=parsed.toJS();
  assert.ok(Object.hasOwn(w.on,'pull_request'));assert.deepEqual(w.on.push,{branches:['**'],tags:['**']});
  assert.equal(w.permissions.contents,'read');assert.equal(w.jobs.deploy.needs,'validate');
  assert.equal(w.jobs.deploy.if,"github.event_name == 'push' && github.ref_type == 'tag'");
  assert.equal(w.jobs.deploy.environment.name,'${{ needs.validate.outputs.channel }}');
  assert.equal(w.jobs.deploy.concurrency['cancel-in-progress'],false);
  for(const job of Object.values(w.jobs))for(const step of job.steps)if(step.uses)assert.match(step.uses,/^actions\/(checkout|setup-node)@[a-f0-9]{40}$/);
  const validation=JSON.stringify(w.jobs.validate);assert.ok(validation.includes('scripts/release.mjs'));assert.ok(validation.includes('npm test'));assert.ok(!validation.includes('FTP_PASSWORD'));
});
