// scripts/prepare-nt-assets.mjs
//
// Regenerates Nite Tanzarn IntellectNest brand assets from authoritative
// upstream inputs. Idempotent; safe to re-run after updating inputs.
//
// Outputs:
//   public/open-graph.webp        - re-encoded live OG card, 1200px wide
//   public/favicon-32.png         - 32x32 PNG copy of the monogram (Apple fallback)
//   public/apple-touch-icon.png   - 180x180 PNG for iOS home screen
//   public/favicon.ico            - multi-resolution 16/32/48 ICO built from PNG bytes
//   src/assets/author.avif        - brand monogram avatar rasterized from
//                                   src/assets/author.svg at 596x596
//
// Inputs (downloaded into scripts/.nt-assets/, ignored by .gitignore):
//   og-card.png     - https://www.nitetanzarn.com/  →  <meta property="og:image">
//   monogram.jpg    - https://www.nitetanzarn.com/  →  <link rel="icon"> monogram
//
// Notes:
//   * The live nitetanzarn.com site has no public portrait of Nite Tanzarn; the
//     about page uses stock photography. avatar is therefore a brand monogram
//     rendered from src/assets/author.svg (the canonical, committable source).
//   * The live site serves only a JPG monogram (no public SVG). The new
//     public/favicon.svg is an authored monogram in the same palette.
//   * .gitignore already excludes scripts/.nt-assets/ via the
//     migrations convention; rerun adding `# scripts/.nt-assets/` if needed.

import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, "..")
const scratch = path.join(here, ".nt-assets")
const publicDir = path.join(projectRoot, "public")
const assetsDir = path.join(projectRoot, "src", "assets")

const SOURCES = [
  {
    label: "og-card",
    url:
      "https://static.wixstatic.com/media/080c01_cd62d69cafb44c68b84c868dd09cf389~mv2.png/v1/fit/w_2500,h_1330,al_c/080c01_cd62d69cafb44c68b84c868dd09cf389~mv2.png",
    filename: "og-card.png",
  },
  {
    label: "monogram",
    url:
      "https://static.wixstatic.com/media/080c01_c2689a767e29454ebf3a8083197f9c37~mv2.jpg/v1/fill/w_512,h_512,al_c,lg_1,q_80,enc_avif,quality_auto/logo%202_page-0001.jpg",
    filename: "monogram.jpg",
  },
]

async function download(input) {
  const res = await fetch(input.url, {
    headers: { "user-agent": "Mozilla/5.0 BlogAssetPipeline/1" },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${input.label}: HTTP ${res.status}`)
  }
  const bytes = Buffer.from(await res.arrayBuffer())
  await writeFile(path.join(scratch, input.filename), bytes)
  return bytes
}

function buildIcoFromPngs(pngs) {
  // Vista+ PNG-in-ICO container format.
  // 6-byte ICONDIR header + 16-byte ICONDIRENTRY per image + raw PNG bytes.
  if (pngs.length === 0 || pngs.length > 0xffff) {
    throw new Error("ICO image count out of range")
  }
  const dirSize = 6 + 16 * pngs.length
  let offset = dirSize
  const entries = pngs.map(({ data, width, height }) => {
    if (data.length > 0xffffffff) {
      throw new Error("ICO image too large")
    }
    const entry = Buffer.alloc(16)
    entry[0] = width >= 256 ? 0 : width
    entry[1] = height >= 256 ? 0 : height
    entry[2] = 0 // palette colors
    entry[3] = 0 // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved (must be 0)
  header.writeUInt16LE(1, 2) // type 1 = icon
  header.writeUInt16LE(pngs.length, 4) // image count
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

async function pngBufferAt(input, size) {
  // sharp.toBuffer({ resolveWithObject: true }) returns { data, info } where
  // { width, height, channels, size } live nested under `info`. Re-shape so the
  // ICO constructor can read width/height off the result directly.
  const { data, info } = await sharp(input)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

async function main() {
  await mkdir(scratch, { recursive: true })
  for (const input of SOURCES) {
    const bytes = await download(input)
    console.log(`[fetch] ${input.label}: ${bytes.length} bytes`)
  }

  // 1. Live OG PNG → public/open-graph.webp (1200px wide, preserve aspect).
  {
    const ogSrc = path.join(scratch, "og-card.png")
    const ogMeta = await sharp(ogSrc).metadata()
    const targetHeight = Math.round(1200 * (ogMeta.height / ogMeta.width))
    await sharp(ogSrc)
      .resize(1200, targetHeight, { fit: "fill", kernel: "lanczos3" })
      .webp({ quality: 88, effort: 5 })
      .toFile(path.join(publicDir, "open-graph.webp"))
    console.log(`[write] public/open-graph.webp 1200x${targetHeight}`)
  }

  // 2. Live monogram JPG → apple-touch-icon.png + favicon-32.png + favicon.ico.
  {
    const monogramSrc = path.join(scratch, "monogram.jpg")
    const appleTouch = path.join(publicDir, "apple-touch-icon.png")
    await sharp(monogramSrc)
      .resize(180, 180, { fit: "cover", kernel: "lanczos3" })
      .png({ compressionLevel: 9 })
      .toFile(appleTouch)
    console.log("[write] public/apple-touch-icon.png 180x180")

    const sizes = [48, 32, 16]
    const pngs = await Promise.all(sizes.map((s) => pngBufferAt(monogramSrc, s)))
    const icoPath = path.join(publicDir, "favicon.ico")
    await writeFile(icoPath, buildIcoFromPngs(pngs))
    console.log(`[write] public/favicon.ico multi-res ${sizes.join("/")}`)
  }

  // 3. Author monogram SVG → src/assets/author.avif at 596x596 (≈2x retina).
  {
    const out = await sharp(path.join(assetsDir, "author.svg"), { density: 384 })
      .resize(596, 596, { fit: "cover", kernel: "lanczos3" })
      .avif({ quality: 70, effort: 6 })
      .toFile(path.join(assetsDir, "author.avif"))
    console.log(`[write] src/assets/author.avif ${out.width}x${out.height} ${out.size}B`)
  }

  await rm(scratch, { recursive: true, force: true })
  console.log("[cleanup] scripts/.nt-assets/")
  console.log("[done] nt asset pipeline complete")
}

main().catch((err) => {
  console.error("[fatal]", err.stack || err.message)
  process.exit(1)
})
