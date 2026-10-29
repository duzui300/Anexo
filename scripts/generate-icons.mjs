import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const sizes = [16, 32, 48, 96, 128];
const source = fileURLToPath(new URL('../public/logo.svg', import.meta.url));
const outDir = fileURLToPath(new URL('../public/icon/', import.meta.url));

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  const target = join(outDir, `${size}.png`);
  await sharp(source).resize(size, size).png().toFile(target);
  console.log(`generated ${join('public', 'icon', `${size}.png`)}`);
}
