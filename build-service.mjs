import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const pkg=JSON.parse(await fs.readFile(new URL('package.json',import.meta.url),'utf8'));
const routes=[["/tv/","index.html","text/html; charset=utf-8"],["/tv/app.css","app.css","text/css; charset=utf-8"],["/tv/app.js","app.js","text/javascript; charset=utf-8"],["/tv/site-tools.js","site-tools.js","text/javascript; charset=utf-8"],["/tv/site-player.js","site-player.js","text/javascript; charset=utf-8"],["/tv/module.js","module.js","text/javascript; charset=utf-8"],["/player-assets/hls-compat.min.js","hls.min.js","text/javascript; charset=utf-8"],["/licenses/hls.js.txt","HLS_LICENSE.txt","text/plain; charset=utf-8"]];
const assets={};
for(const [path,name,type] of routes){const data=await fs.readFile(new URL(name,import.meta.url));assets[path]={type,data};}
if(createHash('sha256').update(assets['/player-assets/hls-compat.min.js'].data).digest('hex')!=='a12e7ee1cd64a69dcdb314157e45dafcba705bfb0b1440b7935cb265d374423e')throw Error('Unexpected HLS file');
assets['/tv/settings']={type:'application/json',data:Buffer.from('{}')};
assets['/status']={type:'application/json',data:Buffer.from(JSON.stringify({app:'freestyle-lite',version:pkg.version}))};
const literal=Object.entries(assets).map(([path,a])=>JSON.stringify(path)+':{type:'+JSON.stringify(a.type)+',data:new Buffer('+JSON.stringify(a.data.toString('base64'))+",'base64')}").join(',\n');
const source=await fs.readFile(new URL('service-template.js',import.meta.url),'utf8')+'\nstartFreestyleService({'+literal+'},'+JSON.stringify(pkg.version)+');\n';
new vm.Script(source);await fs.writeFile(new URL('service.js',import.meta.url),source);
console.log('Service rebuilt: '+pkg.version);
const manifestUrl=new URL('manifest.json',import.meta.url);
const manifest=JSON.parse(await fs.readFile(manifestUrl,'utf8'));
for(const name of Object.keys(manifest.files)){const data=await fs.readFile(new URL(name,import.meta.url));manifest.files[name]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};}
await fs.writeFile(manifestUrl,JSON.stringify(manifest,null,2)+'\n');
