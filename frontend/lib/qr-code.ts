/**
 * Dependency-free QR Code generator (task 27.4 / Requirement 33.9).
 *
 * The repo had no QR library and the existing QR surface
 * ({@link QRPaymentRenderer}) simply renders a backend-provided image URL.
 * Booking confirmations need a QR that works **offline** (PWA requirement), so
 * we generate the matrix on-device instead of depending on a network image.
 *
 * This is a compact, self-contained encoder supporting QR model 2, byte mode,
 * error-correction level M, automatically picking the smallest version that
 * fits the payload (booking URLs / references are short). It exposes
 * {@link encodeQrMatrix} which returns a boolean matrix (`true` = dark module),
 * letting the UI render it however it likes (SVG in our case).
 *
 * Ported to a minimal form from the well-known public-domain QR algorithm
 * (Reed–Solomon ECC over GF(256)). Content was authored for this codebase.
 */

// --- Galois field GF(256) tables (generator 0x11D) ---------------------------

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(function initGalois() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i])
      next[j + 1] ^= poly[j]
    }
    poly = next
  }
  return poly
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen)
  const res = new Array<number>(ecLen).fill(0)
  for (const byte of data) {
    const factor = byte ^ res[0]
    res.shift()
    res.push(0)
    for (let i = 0; i < gen.length; i++) {
      res[i] ^= gfMul(gen[i], factor)
    }
  }
  return res
}

// --- Capacity / EC parameters for ECC level M, versions 1..10 ----------------
// [version]: { totalCodewords, ecPerBlock, group1Blocks, dataPerG1, group2Blocks, dataPerG2 }
interface VersionInfo {
  version: number
  ecCodewordsPerBlock: number
  group1Blocks: number
  group1DataCodewords: number
  group2Blocks: number
  group2DataCodewords: number
}

// Level M parameters (covers short payloads comfortably up to v10).
const VERSIONS_M: VersionInfo[] = [
  {
    version: 1,
    ecCodewordsPerBlock: 10,
    group1Blocks: 1,
    group1DataCodewords: 16,
    group2Blocks: 0,
    group2DataCodewords: 0,
  },
  {
    version: 2,
    ecCodewordsPerBlock: 16,
    group1Blocks: 1,
    group1DataCodewords: 28,
    group2Blocks: 0,
    group2DataCodewords: 0,
  },
  {
    version: 3,
    ecCodewordsPerBlock: 26,
    group1Blocks: 1,
    group1DataCodewords: 44,
    group2Blocks: 0,
    group2DataCodewords: 0,
  },
  {
    version: 4,
    ecCodewordsPerBlock: 18,
    group1Blocks: 2,
    group1DataCodewords: 32,
    group2Blocks: 0,
    group2DataCodewords: 0,
  },
  {
    version: 5,
    ecCodewordsPerBlock: 24,
    group1Blocks: 2,
    group1DataCodewords: 43,
    group2Blocks: 0,
    group2DataCodewords: 0,
  },
  {
    version: 6,
    ecCodewordsPerBlock: 16,
    group1Blocks: 4,
    group1DataCodewords: 27,
    group2Blocks: 0,
    group2DataCodewords: 0,
  },
  {
    version: 7,
    ecCodewordsPerBlock: 18,
    group1Blocks: 4,
    group1DataCodewords: 31,
    group2Blocks: 0,
    group2DataCodewords: 0,
  },
  {
    version: 8,
    ecCodewordsPerBlock: 22,
    group1Blocks: 2,
    group1DataCodewords: 38,
    group2Blocks: 2,
    group2DataCodewords: 39,
  },
  {
    version: 9,
    ecCodewordsPerBlock: 22,
    group1Blocks: 3,
    group1DataCodewords: 36,
    group2Blocks: 2,
    group2DataCodewords: 37,
  },
  {
    version: 10,
    ecCodewordsPerBlock: 26,
    group1Blocks: 4,
    group1DataCodewords: 43,
    group2Blocks: 1,
    group2DataCodewords: 44,
  },
]

function dataCodewordCount(v: VersionInfo): number {
  return v.group1Blocks * v.group1DataCodewords + v.group2Blocks * v.group2DataCodewords
}

function modulesPerSide(version: number): number {
  return version * 4 + 17
}

// --- Bit buffer --------------------------------------------------------------

class BitBuffer {
  bits: number[] = []
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1)
    }
  }
  get length(): number {
    return this.bits.length
  }
}

// --- Encoding ----------------------------------------------------------------

function toUtf8Bytes(str: string): number[] {
  // TextEncoder is available in browsers and Node 11+; guard for safety.
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(str))
  }
  const out: number[] = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
  }
  return out
}

function selectVersion(byteLen: number): VersionInfo {
  for (const v of VERSIONS_M) {
    // 4 bits mode + char-count indicator (8 or 16 bits) + data.
    const ccBits = v.version <= 9 ? 8 : 16
    const dataBitsAvailable = dataCodewordCount(v) * 8
    const needed = 4 + ccBits + byteLen * 8
    if (needed <= dataBitsAvailable) return v
  }
  throw new Error('QR payload too large for supported versions (max v10, level M)')
}

function buildDataCodewords(bytes: number[], v: VersionInfo): number[] {
  const bb = new BitBuffer()
  bb.put(0b0100, 4) // byte mode
  const ccBits = v.version <= 9 ? 8 : 16
  bb.put(bytes.length, ccBits)
  for (const b of bytes) bb.put(b, 8)

  const capacityBits = dataCodewordCount(v) * 8
  // Terminator (up to 4 zero bits).
  const terminator = Math.min(4, capacityBits - bb.length)
  bb.put(0, terminator)
  // Pad to a byte boundary.
  while (bb.length % 8 !== 0) bb.bits.push(0)

  const codewords: number[] = []
  for (let i = 0; i < bb.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.bits[i + j]
    codewords.push(byte)
  }
  // Pad bytes alternate 0xEC / 0x11.
  const padBytes = [0xec, 0x11]
  let pi = 0
  while (codewords.length < dataCodewordCount(v)) {
    codewords.push(padBytes[pi % 2])
    pi++
  }
  return codewords
}

function interleave(dataCodewords: number[], v: VersionInfo): number[] {
  const blocks: { data: number[]; ec: number[] }[] = []
  let offset = 0
  const pushBlocks = (count: number, dataLen: number) => {
    for (let i = 0; i < count; i++) {
      const data = dataCodewords.slice(offset, offset + dataLen)
      offset += dataLen
      blocks.push({ data, ec: rsEncode(data, v.ecCodewordsPerBlock) })
    }
  }
  pushBlocks(v.group1Blocks, v.group1DataCodewords)
  pushBlocks(v.group2Blocks, v.group2DataCodewords)

  const result: number[] = []
  const maxData = Math.max(...blocks.map((b) => b.data.length))
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) result.push(b.data[i])
  }
  for (let i = 0; i < v.ecCodewordsPerBlock; i++) {
    for (const b of blocks) result.push(b.ec[i])
  }
  return result
}

// --- Matrix placement --------------------------------------------------------

type Matrix = (boolean | null)[][]

function makeEmpty(size: number): Matrix {
  return Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null))
}

function placeFinder(m: Matrix, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r
      const cc = col + c
      if (rr < 0 || rr >= m.length || cc < 0 || cc >= m.length) continue
      const dark =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      m[rr][cc] = dark
    }
  }
}

const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
}

function placeAlignment(m: Matrix, version: number): void {
  const positions = ALIGNMENT_POSITIONS[version] ?? []
  for (const r of positions) {
    for (const c of positions) {
      if (m[r][c] !== null) continue // skip overlapping finder corners
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1
          m[r + dr][c + dc] = dark
        }
      }
    }
  }
}

function placeTimings(m: Matrix): void {
  const size = m.length
  for (let i = 8; i < size - 8; i++) {
    const v = i % 2 === 0
    if (m[6][i] === null) m[6][i] = v
    if (m[i][6] === null) m[i][6] = v
  }
}

function reserveFormat(m: Matrix): void {
  const size = m.length
  // Mark format-info cells as reserved (set later). Use a sentinel via false placeholder;
  // we just ensure they aren't treated as data — handled by isFunction check.
  // Dark module:
  m[size - 8][8] = true
}

function isFunctionModule(m: Matrix, version: number, r: number, c: number): boolean {
  const size = m.length
  // Finder + separators
  if (r <= 8 && c <= 8) return true
  if (r <= 8 && c >= size - 8) return true
  if (r >= size - 8 && c <= 8) return true
  // Timing
  if (r === 6 || c === 6) return true
  // Alignment
  const positions = ALIGNMENT_POSITIONS[version] ?? []
  for (const ar of positions) {
    for (const ac of positions) {
      if (ar <= 8 && ac <= 8) continue
      if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) return true
    }
  }
  return false
}

function placeData(m: Matrix, version: number, codewords: number[]): void {
  const size = m.length
  const bits: number[] = []
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1)

  let bitIndex = 0
  let upward = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col-- // skip timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i
      for (let c = 0; c < 2; c++) {
        const cc = col - c
        if (m[row][cc] !== null) continue
        if (isFunctionModule(m, version, row, cc)) continue
        const bit = bitIndex < bits.length ? bits[bitIndex++] : 0
        // Mask 0: (r + c) % 2 === 0 inverts.
        const mask = (row + cc) % 2 === 0
        m[row][cc] = (bit === 1) !== mask ? true : false
      }
    }
    upward = !upward
  }
}

// Format info for EC level M + mask 0, pre-computed (15 bits BCH).
const FORMAT_INFO_M_MASK0 = 0b101010000010010

function placeFormat(m: Matrix): void {
  const size = m.length
  const bits: number[] = []
  for (let i = 14; i >= 0; i--) bits.push((FORMAT_INFO_M_MASK0 >> i) & 1)
  // Around top-left finder.
  for (let i = 0; i <= 5; i++) m[8][i] = bits[i] === 1
  m[8][7] = bits[6] === 1
  m[8][8] = bits[7] === 1
  m[7][8] = bits[8] === 1
  for (let i = 9; i < 15; i++) m[14 - i][8] = bits[i] === 1
  // Around the other two finders.
  for (let i = 0; i <= 7; i++) m[size - 1 - i][8] = bits[i] === 1
  for (let i = 8; i < 15; i++) m[8][size - 15 + i] = bits[i] === 1
}

/**
 * Encode `text` (UTF-8 byte mode, EC level M) into a boolean QR matrix where
 * `true` is a dark module. Throws if the payload exceeds the supported range
 * (versions 1–10) — booking URLs and references are far smaller than that.
 */
export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = toUtf8Bytes(text)
  const version = selectVersion(bytes.length)
  const dataCw = buildDataCodewords(bytes, version)
  const finalCw = interleave(dataCw, version)

  const size = modulesPerSide(version.version)
  const m = makeEmpty(size)
  placeFinder(m, 0, 0)
  placeFinder(m, 0, size - 7)
  placeFinder(m, size - 7, 0)
  placeAlignment(m, version.version)
  placeTimings(m)
  reserveFormat(m)
  placeData(m, version.version, finalCw)
  placeFormat(m)

  // Resolve any remaining nulls (shouldn't happen) to light.
  return m.map((row) => row.map((cell) => cell === true))
}

/**
 * Render a QR matrix as a compact, scalable SVG string. Pure (no DOM), so it
 * works during SSR and can be embedded directly via `dangerouslySetInnerHTML`
 * or as a data URL.
 */
export function qrMatrixToSvg(
  matrix: boolean[][],
  opts?: { margin?: number; size?: number; dark?: string; light?: string },
): string {
  const margin = opts?.margin ?? 4
  const dark = opts?.dark ?? '#000000'
  const light = opts?.light ?? '#ffffff'
  const count = matrix.length
  const dim = count + margin * 2
  const pixelSize = opts?.size ?? dim

  let path = ''
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        path += `M${c + margin} ${r + margin}h1v1h-1z`
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
    `width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges" role="img">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  )
}
