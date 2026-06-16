import sharp from "sharp";

// Brand dark background (#0a0a0a)
const BG = { r: 10, g: 10, b: 10, alpha: 1 };

async function make(size, out, logoWidthRatio) {
  const lw = Math.round(size * logoWidthRatio);
  const logo = await sharp("public/images/ssrg-logo.png").resize({ width: lw }).toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{
      input: logo,
      top: Math.round((size - meta.height) / 2),
      left: Math.round((size - lw) / 2),
    }])
    .png()
    .toFile(out);
  console.log(`Written: ${out} (${size}x${size})`);
}

await make(512, "app/icon.png", 0.72);
await make(180, "app/apple-icon.png", 0.72);
console.log("favicon assets written");
