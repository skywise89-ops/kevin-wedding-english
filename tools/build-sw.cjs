/* Immutable release cache: HTML, scripts and content share one revision. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const files = ['index.html','field.html','practice.html','moments.html','manifest.webmanifest', ...['assets','data','lessons'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(f=>/\.(html|js|css|json|svg|png|ico)$/.test(f)).map(f=>dir+'/'+f))].sort();
const hash = crypto.createHash('sha256');
files.forEach(f=>{hash.update(f);hash.update(fs.readFileSync(path.join(root,f)));});
const hashes = Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
hashes['./']=hashes['index.html'];
const version = 'v3-' + hash.digest('hex').slice(0,12);
const source = fs.readFileSync(path.join(__dirname,'sw-template.js'),'utf8').replace('__VERSION__',version).replace('__ASSETS__',JSON.stringify(['./',...files],null,2)).replace('__HASHES__',JSON.stringify(hashes,null,2));
fs.writeFileSync(path.join(root,'sw.js'), source);
console.log(`Built ${version}: ${files.length+1} offline resources.`);
