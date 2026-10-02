/* Build assets from authored SVGs. sharp is a development dependency only. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const svg = (bg, art) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${bg}"/>${art}</svg>`;
const variants = {
  a: svg('#182d34', '<path d="M100 161h87l23-33h92l23 33h87a26 26 0 0 1 26 26v162a26 26 0 0 1-26 26h-55l-58 51v-51H100a26 26 0 0 1-26-26V187a26 26 0 0 1 26-26Z" fill="#afd7c3"/><circle cx="256" cy="269" r="70" fill="#182d34"/><circle cx="256" cy="269" r="44" fill="#afd7c3"/><circle cx="365" cy="206" r="12" fill="#182d34"/>'),
  b: svg('#16675b', '<path d="M206 112a22 22 0 0 1 20-14h60a22 22 0 0 1 20 14l12 26h37a63 63 0 0 1 63 63v125a63 63 0 0 1-63 63H230l-58 40q-15 10-15-8v-32h-2a63 63 0 0 1-63-63V201a63 63 0 0 1 63-63h39Z" fill="#fff9e9"/><circle cx="256" cy="261" r="75" fill="#16675b"/><circle cx="256" cy="261" r="47" fill="#b4dcca"/><circle cx="240" cy="245" r="14" fill="#fff9e9"/>'),
  c: svg('#f4eee2', '<rect x="87" y="155" width="338" height="226" rx="76" fill="#16675b"/><rect x="192" y="119" width="128" height="84" rx="28" fill="#16675b"/><path d="M321 353v72l68-57Z" fill="#16675b"/><circle cx="256" cy="268" r="77" fill="#f4eee2"/><circle cx="256" cy="268" r="48" fill="#16675b"/><circle cx="241" cy="253" r="15" fill="#b4dcca"/>')
};
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((x, i) => { const p = 6 + i * 16; header[p] = x.size; header[p + 1] = x.size; header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6); header.writeUInt32LE(x.bytes.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += x.bytes.length; });
  return Buffer.concat([header, ...images.map(x => x.bytes)]);
}
(async () => {
  fs.mkdirSync(path.join(root, 'docs/icons'), {recursive:true});
  for (const [key, content] of Object.entries(variants)) fs.writeFileSync(path.join(root, `docs/icons/option-${key}.svg`), content);
  fs.writeFileSync(path.join(root, 'assets/icon-v3.svg'), variants.b);
  fs.writeFileSync(path.join(root, 'assets/icon.svg'), variants.b);
  for (const size of [16, 32, 48, 180, 192, 512, 1024]) {
    const bytes = await sharp(Buffer.from(variants.b)).resize(size, size).flatten({background:'#16675b'}).png().toBuffer();
    fs.writeFileSync(path.join(root, `assets/icon-${size}-v3.png`), bytes);
    if ([180,192,512].includes(size)) fs.writeFileSync(path.join(root, `assets/icon-${size}.png`), bytes);
  }
  const inner = variants.b.replace(/<rect width="512" height="512" fill="#16675b"\/>/, '').replace(/^<svg[^>]*>/, '').replace('</svg>', '');
  const mask = svg('#16675b', `<g transform="translate(64 64) scale(.75)">${inner}</g>`);
  const maskBytes = await sharp(Buffer.from(mask)).resize(512,512).flatten({background:'#16675b'}).png().toBuffer();
  fs.writeFileSync(path.join(root,'assets/icon-maskable-512-v3.png'),maskBytes);
  fs.writeFileSync(path.join(root,'assets/icon-maskable-512.png'),maskBytes);
  const images = [16,32,48].map(size=>({size,bytes:fs.readFileSync(path.join(root,`assets/icon-${size}-v3.png`))}));
  fs.writeFileSync(path.join(root,'assets/favicon-v3.ico'),ico(images));
  console.log('Built 3 icon directions, PNG sizes, maskable and favicon.');
})();
