/**
 * Minimal hand-rolled XLSX writer.
 *
 * Produces a real Office Open XML spreadsheet (a ZIP of XML parts) so the
 * downloaded file opens cleanly in Excel, Google Sheets, and Numbers without
 * pulling in a heavy dependency. The ZIP is written with the "stored"
 * (uncompressed) method — fine for the small mock datasets we export.
 */

const ENCODER = new TextEncoder();

/* ===========================================================
   CRC32 — required by ZIP local + central directory headers
   =========================================================== */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/* ===========================================================
   XML helpers
   =========================================================== */

function escapeXml(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = typeof value === "string" ? value : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Excel column letter for a 1-based index. 1 → "A", 27 → "AA", … */
function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* ===========================================================
   Workbook XML parts
   =========================================================== */

function buildContentTypes(withStyles = false): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    (withStyles
      ? `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      : "") +
    `</Types>`
  );
}

/** Cell formats: 0 = normal, 1 = bold (header row), 2 = link (blue, underlined). */
function buildStylesXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>` +
    `<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`
  );
}

function buildRootRels(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`
  );
}

function buildWorkbookRels(withStyles = false): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    (withStyles
      ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      : "") +
    `</Relationships>`
  );
}

function buildWorkbookXml(sheetName: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
    ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    `<sheet name="${escapeXml(sheetName.slice(0, 31) || "Sheet1")}" sheetId="1" r:id="rId1"/>` +
    `</sheets>` +
    `</workbook>`
  );
}

interface SheetLink {
  ref: string;
  url: string;
}

const isWebAddress = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

function buildSheetXml(
  columns: ExportColumn<unknown>[],
  rows: unknown[],
  boldHeader = false,
  linkLabels: ReadonlySet<string> = new Set(),
): { xml: string; links: SheetLink[] } {
  const headerStyle = boldHeader ? ` s="1"` : "";
  const links: SheetLink[] = [];
  const linkCol = columns.map((c) => linkLabels.has(c.label.trim().toUpperCase()));
  const headerRow =
    `<row r="1">` +
    columns
      .map(
        (c, i) =>
          `<c r="${colLetter(i + 1)}1"${headerStyle} t="inlineStr"><is><t>${escapeXml(c.label)}</t></is></c>`,
      )
      .join("") +
    `</row>`;

  const bodyRows = rows
    .map((row, rowIdx) => {
      const r = rowIdx + 2;
      return (
        `<row r="${r}">` +
        columns
          .map((col, colIdx) => {
            const ref = `${colLetter(colIdx + 1)}${r}`;
            const v = col.value(row);
            if (v === null || v === undefined || v === "") return "";
            if (typeof v === "number" && Number.isFinite(v)) {
              return `<c r="${ref}"><v>${v}</v></c>`;
            }
            if (linkCol[colIdx] && typeof v === "string" && isWebAddress(v)) {
              // A real hyperlink (not just text that looks like one), so a click opens it.
              links.push({ ref, url: v.trim() });
              return `<c r="${ref}" s="2" t="inlineStr"><is><t>${escapeXml(v)}</t></is></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(v)}</t></is></c>`;
          })
          .filter(Boolean)
          .join("") +
        `</row>`
      );
    })
    .join("");

  const hyperlinks = links.length
    ? `<hyperlinks>${links.map((l, i) => `<hyperlink ref="${l.ref}" r:id="rIdLink${i + 1}"/>`).join("")}</hyperlinks>`
    : "";
  return {
    xml:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` +
      ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheetData>${headerRow}${bodyRows}</sheetData>` +
      hyperlinks +
      `</worksheet>`,
    links,
  };
}

/** The worksheet's links to the outside (one relationship per hyperlink). */
function buildSheetRels(links: SheetLink[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    links
      .map(
        (l, i) =>
          `<Relationship Id="rIdLink${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(l.url)}" TargetMode="External"/>`,
      )
      .join("") +
    `</Relationships>`
  );
}

/* ===========================================================
   Minimal ZIP (stored method) — assembles the parts into .xlsx
   =========================================================== */

interface PendingFile {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function buildZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const pending: PendingFile[] = [];
  const localParts: Uint8Array[] = [];
  let offset = 0;

  // Local file headers + data
  for (const f of files) {
    const data = ENCODER.encode(f.content);
    const nameBytes = ENCODER.encode(f.name);
    const crc = crc32(data);

    const header = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true); // signature
    dv.setUint16(4, 20, true); // version
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // compression: stored
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, 0x21, true); // mod date (1980-01-01)
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true); // compressed size
    dv.setUint32(22, data.length, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra length
    header.set(nameBytes, 30);

    pending.push({ name: f.name, data, crc, offset });
    localParts.push(header, data);
    offset += header.length + data.length;
  }

  // Central directory
  const centralParts: Uint8Array[] = [];
  let centralSize = 0;
  for (const p of pending) {
    const nameBytes = ENCODER.encode(p.name);
    const entry = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(entry.buffer);
    dv.setUint32(0, 0x02014b50, true); // signature
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true); // flags
    dv.setUint16(10, 0, true); // compression
    dv.setUint16(12, 0, true); // mod time
    dv.setUint16(14, 0x21, true); // mod date
    dv.setUint32(16, p.crc, true);
    dv.setUint32(20, p.data.length, true); // compressed size
    dv.setUint32(24, p.data.length, true); // uncompressed size
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint16(30, 0, true); // extra length
    dv.setUint16(32, 0, true); // comment length
    dv.setUint16(34, 0, true); // disk number
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, p.offset, true); // local header offset
    entry.set(nameBytes, 46);

    centralParts.push(entry);
    centralSize += entry.length;
  }

  // End of central directory record
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // disk with CD
  eocdView.setUint16(8, pending.length, true); // entries on disk
  eocdView.setUint16(10, pending.length, true); // total entries
  eocdView.setUint32(12, centralSize, true); // CD size
  eocdView.setUint32(16, offset, true); // CD offset (= total local size)
  eocdView.setUint16(20, 0, true); // comment length

  return concatBytes([...localParts, ...centralParts, eocd]);
}

/* ===========================================================
   Public API
   =========================================================== */

export interface ExportColumn<T> {
  label: string;
  /** Pull a cell value out of a row. Numbers are written as numbers; everything else as inline strings. */
  value: (row: T) => string | number | null | undefined;
}

export interface XLSXOptions {
  /** Make the header row bold. */
  boldHeader?: boolean;
  /** Column labels (any case) whose web addresses become clickable links. */
  linkColumns?: string[];
}

/** Build an .xlsx Blob from a typed row set and column definitions. */
export function toXLSX<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  sheetName = "Sheet1",
  options: XLSXOptions = {},
): Blob {
  const bold = options.boldHeader === true;
  const linkLabels = new Set((options.linkColumns ?? []).map((l) => l.trim().toUpperCase()));
  const cols = columns as ExportColumn<unknown>[];
  const sheet = buildSheetXml(cols, rows as unknown[], bold, linkLabels);
  const withStyles = bold || sheet.links.length > 0;

  const zip = buildZip([
    { name: "[Content_Types].xml", content: buildContentTypes(withStyles) },
    { name: "_rels/.rels", content: buildRootRels() },
    { name: "xl/workbook.xml", content: buildWorkbookXml(sheetName) },
    { name: "xl/_rels/workbook.xml.rels", content: buildWorkbookRels(withStyles) },
    { name: "xl/worksheets/sheet1.xml", content: sheet.xml },
    ...(sheet.links.length ? [{ name: "xl/worksheets/_rels/sheet1.xml.rels", content: buildSheetRels(sheet.links) }] : []),
    ...(withStyles ? [{ name: "xl/styles.xml", content: buildStylesXml() }] : []),
  ]);

  return new Blob([new Uint8Array(zip)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
