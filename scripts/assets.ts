import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Production resizing/encoding only. The approved artwork masters remain unchanged.
await mkdir("public/mascot", { recursive: true });
const masters = [
  { input: "sj-camera-original.png", output: "sj-camera.webp", size: 512 },
  { input: "sj-history.png", output: "sj-history.webp", size: 512 },
  { input: "sj-icon-master.png", output: "sj-icon.webp", size: 256 },
];
for (const asset of masters) {
  await sharp(`public/mascot/${asset.input}`).resize(asset.size, asset.size, { fit: "contain" }).webp({ quality: 90, alphaQuality: 100 }).toFile(`public/mascot/${asset.output}`);
}
for (const size of [32, 180, 192, 512]) {
  await sharp("public/mascot/sj-icon-master.png").resize(size, size).png().toFile(`public/icon-sj-${size}.png`);
}
