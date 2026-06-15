import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "assets");
const svgPath = path.join(assetsDir, "icon.svg");
const pngPath = path.join(assetsDir, "icon.png");
const icoPath = path.join(assetsDir, "icon.ico");

await mkdir(assetsDir, { recursive: true });

const svg = await readFile(svgPath);
const png = await sharp(svg).resize(256, 256).png().toBuffer();
await writeFile(pngPath, png);

const ico = await pngToIco([
  await sharp(svg).resize(16, 16).png().toBuffer(),
  await sharp(svg).resize(24, 24).png().toBuffer(),
  await sharp(svg).resize(32, 32).png().toBuffer(),
  await sharp(svg).resize(48, 48).png().toBuffer(),
  await sharp(svg).resize(64, 64).png().toBuffer(),
  png
]);
await writeFile(icoPath, ico);
