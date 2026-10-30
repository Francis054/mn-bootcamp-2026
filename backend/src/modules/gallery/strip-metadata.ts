const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Remove location and other metadata from a JPEG, PNG, or WebP.
 * The image pixels stay. SVG and anything else is returned unchanged
 * so the existing type check can refuse it.
 */
export function stripImageMetadata(bytes: Buffer): Buffer {
  if (isJpeg(bytes)) return stripJpeg(bytes);
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return stripPng(bytes);
  if (isWebp(bytes)) return stripWebp(bytes);
  return bytes;
}

function isJpeg(bytes: Buffer): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.length > 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  );
}

/** Drop EXIF (APP1), IPTC (APP13), and comments. GPS lives in APP1. */
function stripJpeg(bytes: Buffer): Buffer {
  const parts: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      parts.push(bytes.subarray(offset));
      break;
    }
    let markerAt = offset;
    while (markerAt < bytes.length && bytes[markerAt] === 0xff) markerAt += 1;
    if (markerAt >= bytes.length) break;
    const marker = bytes[markerAt] ?? 0;
    const start = markerAt - 1;
    if (marker === 0xd9) {
      parts.push(bytes.subarray(start, markerAt + 1));
      break;
    }
    if (marker === 0xda) {
      parts.push(bytes.subarray(start));
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      parts.push(bytes.subarray(start, markerAt + 1));
      offset = markerAt + 1;
      continue;
    }
    if (markerAt + 3 > bytes.length) return bytes;
    const length = bytes.readUInt16BE(markerAt + 1);
    const end = markerAt + 1 + length;
    if (length < 2 || end > bytes.length) return bytes;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) parts.push(bytes.subarray(start, end));
    offset = end;
  }
  return Buffer.concat(parts);
}

const PNG_TEXT = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(bytes: Buffer): Buffer {
  const parts: Buffer[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let dropped = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) return bytes;
    if (PNG_TEXT.has(type)) dropped = true;
    else parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  if (!dropped) return bytes;
  return Buffer.concat(parts);
}

/** Drop EXIF and XMP chunks and clear those flags on a VP8X header. */
function stripWebp(bytes: Buffer): Buffer {
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let offset = 12;
  let dropped = false;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (end > bytes.length) return bytes;
    const data = bytes.subarray(start, end);
    if (type === 'EXIF' || type === 'XMP ') {
      dropped = true;
    } else if (type === 'VP8X' && data.length > 0) {
      const next = Buffer.from(data);
      const flags = next[0] ?? 0;
      next[0] = flags & ~0x0c;
      chunks.push({ type, data: next });
    } else {
      chunks.push({ type, data: Buffer.from(data) });
    }
    offset = end + (size % 2 === 1 ? 1 : 0);
  }
  if (!dropped) return bytes;
  let payload = 4;
  for (const chunk of chunks) payload += 8 + chunk.data.length + (chunk.data.length % 2);
  const out = Buffer.alloc(8 + payload);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(payload, 4);
  out.write('WEBP', 8, 'ascii');
  let cursor = 12;
  for (const chunk of chunks) {
    out.write(chunk.type, cursor, 'ascii');
    out.writeUInt32LE(chunk.data.length, cursor + 4);
    chunk.data.copy(out, cursor + 8);
    cursor += 8 + chunk.data.length;
    if (chunk.data.length % 2 === 1) cursor += 1;
  }
  return out;
}
