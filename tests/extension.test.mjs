import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ext=path.join(root,'extension');
const uri=p=>pathToFileURL(path.join(ext,p)).href;
const manifest=JSON.parse(await fs.readFile(path.join(ext,'manifest.json'),'utf8'));
const store={}, listeners=new Set(), handlers=[];
let mode='metadata', outgoing=[];
const report=[];
function ok(name,fn){fn();report.push({name,passed:true});}
async function asyncOk(name,fn){await fn();report.push({name,passed:true});}

globalThis.chrome={storage:{local:{
 async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>k in store).map(k=>[k,structuredClone(store[k])]));},
 async set(values){const changes={};for(const[k,v]of Object.entries(values)){changes[k]={oldValue:store[k],newValue:v};store[k]=structuredClone(v);}for(const fn of listeners)fn(changes,'local');},
 async remove(key){delete store[key];}
},onChanged:{addListener(fn){listeners.add(fn);}}},runtime:{id:'test-extension',getURL:uri,getManifest:()=>manifest,
 onInstalled:{addListener(){}},onMessage:{addListener(fn){handlers.push(fn);}},sendMessage:dispatch}};

function response(data,url){const result=new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});Object.defineProperty(result,'url',{value:url});return result;}
globalThis.fetch=async(url,options={})=>{
 const text=String(url);
 if(text.startsWith('file:'))return new Response(await fs.readFile(fileURLToPath(text)),{status:200});
 outgoing.push({url:text,options});
 if(mode==='abort')return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
 const doi=decodeURIComponent(new URL(text).pathname.slice('/works/'.length));
 const record={DOI:doi,type:'journal-article','container-title':['Information Fusion'],ISSN:['1566-2535']};
 if(new URL(text).searchParams.has('query.title'))return response({message:{items:[{...record,DOI:'10.1000/citelocus.title',title:[new URL(text).searchParams.get('query.title')],author:[{given:'Chen',family:'Wang'}],published:{'date-parts':[[2025]]}}]}},text);
 return response({message:record},text);
};
function dispatch(message){return new Promise((resolve,reject)=>{let handled=false;const timer=setTimeout(()=>reject(new Error('Message did not reply: '+message.type)),3000);for(const fn of handlers){if(fn(message,{id:'test-extension',url:'https://scholar.google.com/scholar'},value=>{clearTimeout(timer);resolve(value);})===true)handled=true;}if(!handled){clearTimeout(timer);resolve(undefined);}});}
await import(uri('local/migrate.mjs'));
const {snapshot}=await import(uri('app/storage.mjs'));
const {createMatcher}=await import(uri('app/catalog.mjs'));
const {rankingMarks,translator}=await import(uri('app/ui.mjs'));
const {identifyOwner,authorship}=await import(uri('app/model.mjs'));
const state=await snapshot();
const counts=Object.fromEntries(Object.entries(state.catalogs).map(([id,value])=>[id,{edition:value.edition,count:value.records.length}]));
ok('Fresh install initializes all seven bundled catalogs',()=>assert.deepEqual(Object.keys(counts).sort(),['cas','ccf','jcr','pku','sci','warning','xr']));
ok('Catalog record counts match the prepared editions',()=>assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([id,x])=>[id,x.count])),{ccf:676,pku:1987,jcr:20337,cas:21772,xr:22298,warning:5,sci:9415}));
ok('Online venue lookup is disabled by default',()=>assert.equal(state.preferences.onlineLookup,false));
const match=createMatcher(state.catalogs,state.enabled);
const labels=(name,type='',issn)=>rankingMarks(match(name,type,issn),translator('zh')).map(x=>x.text);
ok('TPAMI retains all five applicable badges',()=>{const x=labels('IEEE Transactions on Pattern Analysis and Machine Intelligence');assert.equal(x.length,5);assert(x.includes('CCF-A'));assert(x.includes('JCR-Q1 · IF 20.4'));assert(x.includes('SCI'));});
ok('Workshop and Findings remain separate conference tracks',()=>{assert(labels('Findings of the Association for Computational Linguistics: EMNLP 2025').some(x=>/^CCF-[ABC] Findings$/.test(x)));assert(labels('CVPR Workshops').some(x=>/^CCF-[ABC] Workshop/.test(x)));});
ok('Both requested Chinese journal names retain PKU Core badges',()=>{assert(labels('测绘科学 44 (4)').includes('北大核心'));assert(labels('中国图象图形学报 28 (6)').includes('北大核心'));});
ok('Unrecognized IEEE journal is not assumed to be SCI',()=>assert(!labels('IEEE Transactions on Imaginary Unverified Topic').includes('SCI')));
await asyncOk('Bundled IEEE article identifiers resolve while offline',async()=>{const source=await dispatch({type:'citelocus-ieee-article',id:'10949864'});assert.equal(source.venue,'IEEE Transactions on Pattern Analysis and Machine Intelligence');assert.equal(outgoing.length,0);});
await asyncOk('Springer DOI and ScienceDirect PII verified records remain available offline',async()=>{const springer=await dispatch({type:'citelocus-doi-article',id:'10.1007/s00521-024-10165-7'});const elsevier=await dispatch({type:'citelocus-pii-article',id:'S2214914722000319'});assert.equal(springer.venue,'Neural Computing and Applications');assert.equal(elsevier.venue,'Defence Technology');assert.equal(outgoing.length,0);});
await asyncOk('Unrecognized DOI makes no network request by default',async()=>{assert.equal(await dispatch({type:'citelocus-doi-article',id:'10.1000/citelocus.default'}),null);assert.equal(outgoing.length,0);});
await asyncOk('Online setting alone cannot bypass first-use consent',async()=>{await chrome.storage.local.set({onlineLookup:true});assert.equal(await dispatch({type:'citelocus-doi-article',id:'10.1000/citelocus.no-consent'}),null);assert.equal(outgoing.length,0);});
await asyncOk('Explicit consent and online enable permit public DOI metadata requests',async()=>{await chrome.storage.local.set({'page-consent':true});const source=await dispatch({type:'citelocus-doi-article',id:'10.1000/citelocus.enabled'});assert.equal(source.venue,'Information Fusion');assert.equal(outgoing.length,1);assert.equal(outgoing[0].options.credentials,'omit');assert.equal(outgoing[0].options.referrerPolicy,'no-referrer');});
await asyncOk('Title query sends title and selectors, keeping author/year validation local',async()=>{const source=await dispatch({type:'citelocus-title-article',id:{title:'A public paper title for lookup testing',author:'C Wang',year:2025}});assert.equal(source.venue,'Information Fusion');const query=new URL(outgoing.at(-1).url).searchParams;assert.deepEqual([...query.keys()].sort(),['query.title','rows','select']);assert(!outgoing.at(-1).url.includes('C%20Wang'));assert(!query.has('author'));assert(!query.has('year'));});
await asyncOk('Turning off cancels an active request and blocks subsequent requests',async()=>{mode='abort';const request=dispatch({type:'citelocus-doi-article',id:'10.1000/citelocus.pending'});await new Promise(resolve=>setTimeout(resolve,15));const before=outgoing.length;await chrome.storage.local.set({onlineLookup:false});assert.equal(await request,null);assert.equal(await dispatch({type:'citelocus-doi-article',id:'10.1000/citelocus.disabled'}),null);assert.equal(outgoing.length,before);});

const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body><main id="app" data-view="catalogs"></main></body></html>',{url:'https://scholar.google.com/scholar',runScripts:'outside-only'});
Object.assign(globalThis,{document:dom.window.document,location:dom.window.location,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
vm.runInContext(await fs.readFile(path.join(ext,'vendor/pinyin-pro.js'),'utf8'),dom.getInternalVMContext());
ok('Chinese names and English initials identify first/corresponding author roles',()=>{const identify=identifyOwner('王晨',dom.window.pinyinPro.segment);assert.equal(authorship('C Wang, Y Liu',identify).role,'first');assert.equal(authorship('Y Liu, C Wang*',identify).corresponding,true);assert.equal(authorship('王晨, 刘洋',identify).role,'first');assert.equal(authorship('C Wang, C Wang',identify).role,'unmatched');});
await chrome.storage.local.set({'page-consent':false,locale:'zh'});
await asyncOk('Declined first-use consent pauses until a later explicit acceptance',async()=>{const {requestPageConsent}=await import(uri('app/consent.mjs'));const pending=requestPageConsent();await new Promise(resolve=>setTimeout(resolve,0));const host=document.querySelector('[data-citelocus-consent]');assert(host);assert(!document.querySelector('.cl-badges'));assert.match(host.shadowRoot.textContent,/已暂停/);host.shadowRoot.querySelector('button').click();const buttons=host.shadowRoot.querySelectorAll('button');buttons[1].click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(store['page-consent'],false);host.shadowRoot.querySelector('button').click();host.shadowRoot.querySelector('.primary').click();assert.equal(await pending,true);assert.equal(store['page-consent'],true);assert(!document.querySelector('[data-citelocus-consent]'));});
await asyncOk('Settings disclose destination and expose an initially disabled online checkbox',async()=>{await import(uri('app/settings.mjs'));await new Promise(resolve=>setTimeout(resolve,100));const section=document.querySelector('[data-online-lookup]');assert(section);assert.match(section.textContent,/Crossref/);assert.match(section.textContent,/默认关闭/);assert.equal(section.querySelector('input').checked,false);assert.match(section.querySelector('a').href,/privacy\.html$/);});
await asyncOk('Enabling online lookup refreshes a previously unresolved live result',async()=>{
 mode='metadata';
 document.body.innerHTML='<div class="gs_r"><div class="gs_ri"><h3 class="gs_rt"><a href="https://example.org/paper">A previously unresolved article to test refresh</a></h3><div class="gs_a">C Wang - …, 2025 - example.org</div></div></div>';
 const {launch}=await import(uri('app/scholar.mjs'));
 await launch();
 await new Promise(resolve=>setTimeout(resolve,50));
 assert(!document.querySelector('.cl-badges').textContent.includes('SCI'));
 const before=outgoing.length;
 await chrome.storage.local.set({onlineLookup:true});
 await new Promise(resolve=>setTimeout(resolve,250));
 assert(document.querySelector('.cl-badges').textContent.includes('SCI'));
 assert.equal(outgoing.length,before+1);
 await chrome.storage.local.set({onlineLookup:false});
});
await fs.mkdir(path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/verification-report.json'),JSON.stringify({date:'2026-11-11',version:manifest.version,tests:report,catalogs:counts,network_requests:'All external requests in this test were mocked. No user page or publication query was transmitted.',scope:'Changed store consent and network controls, existing authorship and catalog matching, popup file identity. This is not an authenticated Google Scholar/Chrome Web Store live test.'},null,2));
console.log(JSON.stringify({passed:report.length,catalogs:counts},null,2));
dom.window.close();
