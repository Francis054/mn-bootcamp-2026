import { inflateRawSync } from 'node:zlib';

export type CellValue = string | number;

export interface SheetGrid {
  rows: Map<number, Map<number, CellValue>>;
  merges: Array<{ r1: number; c1: number; r2: number; c2: number }>;
}

/** Read an .xlsx buffer. Encrypted workbooks and exotic compressions are rejected. */
export function readXlsx(buffer: Buffer): Map<string, SheetGrid> {
  const files = unzip(buffer);
  const shared = sharedStrings(files.get('xl/sharedStrings.xml'));
  const workbook = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) {
    throw new Error('The workbook is missing its sheet list.');
  }
  const relMap = relationships(rels);
  const sheets = new Map<string, SheetGrid>();
  for (const sheet of sheetEntries(workbook)) {
    const target = relMap.get(sheet.relId);
    if (!target) continue;
    const path = target.startsWith('xl/') ? target : `xl/${target.replace(/^\//, '')}`;
    const xml = files.get(path);
    if (!xml) continue;
    sheets.set(sheet.name, readSheet(xml, shared));
  }
  return sheets;
}

function unzip(buffer: Buffer): Map<string, string> {
  const eocd = findEocd(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = new Map<string, string>();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('The workbook zip directory is not readable.');
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`The zip entry ${name} has no local header.`);
    }
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compSize);
    const bytes = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (!bytes) throw new Error(`Unsupported compression for ${name}.`);
    files.set(name, bytes.toString('utf8'));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function findEocd(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 22 - 0xffff);
  for (let index = buffer.length - 22; index >= min; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index;
  }
  throw new Error('The file is not an xlsx workbook.');
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const values: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const body = match[1] ?? '';
    const parts = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) =>
      decodeXml(part[1] ?? ''),
    );
    values.push(parts.join(''));
  }
  return values;
}

function relationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = attributes(match[1] ?? '');
    if (attrs.Id && attrs.Target) map.set(attrs.Id, attrs.Target);
  }
  return map;
}

function sheetEntries(xml: string): Array<{ name: string; relId: string }> {
  const sheets: Array<{ name: string; relId: string }> = [];
  for (const match of xml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = attributes(match[1] ?? '');
    const relId = attrs['r:id'];
    if (attrs.name && relId) sheets.push({ name: attrs.name, relId });
  }
  return sheets;
}

function readSheet(xml: string, shared: string[]): SheetGrid {
  const rows = new Map<number, Map<number, CellValue>>();
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = attributes(rowMatch[1] ?? '');
    const rowNumber = Number(rowAttrs.r);
    if (!Number.isInteger(rowNumber)) continue;
    const row = new Map<number, CellValue>();
    const body = rowMatch[2] ?? '';
    for (const cellMatch of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = attributes(cellMatch[1] ?? '');
      const ref = attrs.r;
      if (!ref) continue;
      const column = columnIndex(ref);
      const inner = cellMatch[2] ?? '';
      const value = cellValue(attrs.t, inner, shared);
      if (value !== null) row.set(column, value);
    }
    if (row.size > 0) rows.set(rowNumber, row);
  }
  const merges: SheetGrid['merges'] = [];
  for (const match of xml.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)) {
    const c1 = columnIndex(`${match[1] ?? 'A'}1`);
    const r1 = Number(match[2]);
    const c2 = columnIndex(`${match[3] ?? 'A'}1`);
    const r2 = Number(match[4]);
    if (r1 && r2) merges.push({ r1, c1, r2, c2 });
  }
  return { rows, merges };
}

function cellValue(type: string | undefined, inner: string, shared: string[]): CellValue | null {
  if (type === 'inlineStr') {
    const parts = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) =>
      decodeXml(part[1] ?? ''),
    );
    return parts.join('') || null;
  }
  const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (raw === undefined) return null;
  const text = decodeXml(raw);
  if (type === 's') {
    const index = Number(text);
    return shared[index] ?? text;
  }
  if (type === 'str') return text;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function attributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:]+)="([^"]*)"/g)) {
    const key = match[1];
    if (key) attrs[key] = decodeXml(match[2] ?? '');
  }
  return attrs;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let value = 0;
  for (const char of letters) value = value * 26 + (char.charCodeAt(0) - 64);
  return value;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Copy the top-left value across each merge. Returns how many blank cells were filled. */
export function expandMerges(grid: SheetGrid): number {
  let filled = 0;
  for (const merge of grid.merges) {
    const master = grid.rows.get(merge.r1)?.get(merge.c1);
    if (master === undefined) continue;
    for (let row = merge.r1; row <= merge.r2; row += 1) {
      let cells = grid.rows.get(row);
      if (!cells) {
        cells = new Map();
        grid.rows.set(row, cells);
      }
      for (let column = merge.c1; column <= merge.c2; column += 1) {
        if (row === merge.r1 && column === merge.c1) continue;
        if (!cells.has(column)) {
          cells.set(column, master);
          filled += 1;
        }
      }
    }
  }
  return filled;
}
