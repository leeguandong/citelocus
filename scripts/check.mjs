import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ext=path.join(root,'extension');
const manifest=JSON.parse(await fs.readFile(path.join(ext,'manifest.json'),'utf8'));
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
assert.equal(manifest.version,pkg.version);
assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['storage']);
assert.equal(await fs.readFile(path.join(ext,'privacy.html'),'utf8'),await fs.readFile(path.join(root,'docs/index.html'),'utf8'));
const resources=[...Object.values(manifest.icons),manifest.background.service_worker,manifest.action.default_popup,manifest.options_ui.page,...manifest.content_scripts.flatMap(x=>[...x.js,...x.css])];
for(const resource of resources)await fs.access(path.join(ext,resource));
const patterns=[/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/[A-Za-z]:[\/]+Users[\/]+/];
let count=0;
async function visit(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(['node_modules','dist','.git'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory()){await visit(file);continue;}if(!/.(?:mjs|js|json|html|css|md|txt|yml|yaml|py)$/.test(file))continue;const text=await fs.readFile(file,'utf8');for(const pattern of patterns)assert(!pattern.test(text),'Unexpected sensitive content in '+path.relative(root,file));if(file.endsWith('.mjs')&&file.startsWith(ext)){for(const found of text.matchAll(/(?:froms+|imports*)['"](.[^'"]+)['"]/g))await fs.access(path.resolve(path.dirname(file),found[1]));}count++;}}
await visit(root);
console.log(JSON.stringify({version:manifest.version,text_files_checked:count,resources:'ok',policy_copies:'identical',sensitive_content_scan:'passed'}));
