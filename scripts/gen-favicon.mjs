import sharp from "sharp";

// Favicon assets generated from the SSRG wordmark (public/images/ssrg-logo.png,
// which is BLACK artwork with transparency).
//
// - Browser-tab favicon (app/icon.png): the dark mark on a TRANSPARENT
//   background — visible on the light tab bars most desktop browsers use.
//   (Trade-off: low contrast on dark-mode tabs.)
// - iOS home-screen icon (app/apple-icon.png): iOS composites apple-touch-icons
//   onto black, so a dark mark would vanish — use the WHITE mark on the brand
//   dark tile instead so the home-screen icon stays legible.

const DARK_TILE = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function make(size, out, { background, white, logoWidthRatio = 0.72 }) {
  const lw = Math.round(size * logoWidthRatio);
  let pipeline = sharp("public/images/ssrg-logo.png");
  if (white) pipeline = pipeline.negate({ alpha: false }); // black artwork -> white
  const logo = await pipeline.resize({ width: lw }).toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([
      {
        input: logo,
        top: Math.round((size - meta.height) / 2),
        left: Math.round((size - lw) / 2),
      },
    ])
    .png()
    .toFile(out);
  console.log(`Written: ${out} (${size}x${size})`);
}

// Tab favicon: dark mark, transparent background.
await make(512, "app/icon.png", { background: TRANSPARENT, white: false });
// iOS home screen: white mark on the brand dark tile (iOS forces an opaque bg).
await make(180, "app/apple-icon.png", { background: DARK_TILE, white: true });
console.log("favicon assets written");
