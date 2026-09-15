const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const TEMPLATE_PATH = path.join(ROOT, "template", "report-template.xlsx");

const ITEM_GROUPS = [
  { id: "item01", row: 4, rows: 3, label: "1. 人材獲得競争" },
  { id: "item02", row: 7, rows: 4, label: "2. 人材品質：ロープレ（指差し・積木・必要性）" },
  { id: "item03", row: 11, rows: 4, label: "3. お客様の言葉" },
  { id: "item04", row: 15, rows: 4, label: "4. 生活安全品質：Windows10" },
  { id: "item05", row: 19, rows: 3, label: "5. 教養携帯要件（仲間獲得） / 1204「社長の約束」" },
  { id: "item06", row: 22, rows: 3, label: "6. 教養携帯要件（仲間獲得） / 構造要約書＋pcd2.0映像" },
  { id: "item07", row: 25, rows: 3, label: "7. SL系資料" },
  { id: "item08", row: 28, rows: 3, label: "8. 公開情報：書簡を尊重" },
  { id: "item09", row: 31, rows: 3, label: "9. 公開情報：発刊物を尊重" },
  { id: "item10", row: 34, rows: 3, label: "10. FAS手帳" },
  { id: "item11", row: 37, rows: 4, label: "11. VTR SLS必要論「読み書き」" },
  { id: "item12", row: 41, rows: 4, label: "12. AO校COD 講座・BOXの価値説明・枠ロープレ" },
  { id: "item13", row: 46, rows: 1, label: "13. 経営監査（1）「人材獲得競争に勝つ」の課題認識" },
  { id: "item14", row: 47, rows: 1, label: "14. 経営監査（2）「SLD普及活動」の課題認識" },
  { id: "item15", row: 48, rows: 1, label: "15. 経営監査（3）「お客様とどれだけ話しているか」" },
  { id: "item16", row: 49, rows: 1, label: "16. 絶対品質監査＝文化の監査「お客様にお出ししている文章は全員が目を通しているか」" }
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 5 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlCellValue(attrs, value) {
  const text = String(value ?? "").trim();
  const cleanAttrs = attrs
    .replace(/\/\s*$/, "")
    .replace(/\s+t="[^"]*"/g, "")
    .replace(/\s+cm="[^"]*"/g, "");

  if (!text) {
    return `<c${cleanAttrs}/>`;
  }

  const preserve = /^\s|\s$|\n/.test(String(value));
  const space = preserve ? ' xml:space="preserve"' : "";
  return `<c${cleanAttrs} t="inlineStr"><is><t${space}>${escapeXml(value)}</t></is></c>`;
}

function setCellText(xml, ref, value) {
  const escapedRef = ref.replace(/\$/g, "\\$");
  const emptyCell = new RegExp(`<c\\b([^>]*\\br="${escapedRef}"[^>]*)\\/>`);
  if (emptyCell.test(xml)) {
    return xml.replace(emptyCell, (_, attrs) => xmlCellValue(attrs, value));
  }

  const normalCell = new RegExp(`<c\\b([^>]*\\br="${escapedRef}"[^>]*)>[\\s\\S]*?<\\/c>`);
  if (normalCell.test(xml)) {
    return xml.replace(normalCell, (_, attrs) => xmlCellValue(attrs, value));
  }

  const rowNumber = ref.match(/\d+/)?.[0];
  const rowCell = new RegExp(`(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)`);
  if (!rowNumber || !rowCell.test(xml)) return xml;
  return xml.replace(rowCell, `$1${xmlCellValue(` r="${ref}"`, value)}`);
}

function shiftRows(xml, startRow, delta) {
  return xml.replace(/\b(r=")([A-Z]+)(\d+)(")/g, (match, prefix, col, row, suffix) => {
    const nextRow = Number(row) >= startRow ? Number(row) + delta : Number(row);
    return `${prefix}${col}${nextRow}${suffix}`;
  }).replace(/\b(r=")(\d+)(")/g, (match, prefix, row, suffix) => {
    const nextRow = Number(row) >= startRow ? Number(row) + delta : Number(row);
    return `${prefix}${nextRow}${suffix}`;
  });
}

function shiftMergeRefs(xml, startRow, delta) {
  return xml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (match, startCol, start, endCol, end) => {
    let nextStart = Number(start);
    let nextEnd = Number(end);
    if (nextStart >= startRow) nextStart += delta;
    if (nextEnd >= startRow) nextEnd += delta;
    return `<mergeCell ref="${startCol}${nextStart}:${endCol}${nextEnd}"/>`;
  });
}

function extendVerticalMergeEnds(xml, cols, endRow, delta) {
  for (const col of cols) {
    const merge = new RegExp(`<mergeCell ref="${col}(\\d+):${col}${endRow}"\\/>`);
    xml = xml.replace(merge, (_, start) => `<mergeCell ref="${col}${start}:${col}${endRow + delta}"/>`);
  }
  return xml;
}

function cloneRow(rowXml, targetRow) {
  return rowXml
    .replace(/\br="\d+"/, `r="${targetRow}"`)
    .replace(/\br="([A-Z]+)\d+"/g, `r="$1${targetRow}"`)
    .replace(/<c\b([^>]*\br="B\d+"[^>]*)>[\s\S]*?<\/c>/, (match, attrs) => xmlCellValue(attrs, ""))
    .replace(/<c\b([^>]*\br="B\d+"[^>]*)\/>/, (match, attrs) => xmlCellValue(attrs, ""));
}

function rowXmlAt(xml, row) {
  return xml.match(new RegExp(`<row\\b[^>]*\\br="${row}"[\\s\\S]*?<\\/row>`))?.[0] || "";
}

function insertRows(xml, insertAt, count, templateRow) {
  if (count <= 0) return xml;
  const shifted = shiftMergeRefs(shiftRows(xml, insertAt, count), insertAt, count);
  const insertAfter = insertAt - 1;
  const previousRow = rowXmlAt(shifted, insertAfter);
  const rows = Array.from({ length: count }, (_, index) => cloneRow(templateRow, insertAt + index)).join("");
  if (previousRow) return shifted.replace(previousRow, `${previousRow}${rows}`);
  return shifted.replace(/(<sheetData[^>]*>)/, `$1${rows}`);
}

function addRowMerges(xml, rows) {
  if (!rows.length) return xml;
  return addMergeRefs(xml, rows.flatMap((row) => [`C${row}:D${row}`, `E${row}:G${row}`]));
}

function addMergeRefs(xml, refs) {
  if (!refs.length) return xml;
  const additions = refs.map((ref) => `<mergeCell ref="${ref}"/>`).join("");
  if (/<mergeCells\b[^>]*>/.test(xml)) {
    return xml.replace(/(<mergeCells\b[^>]*>)/, `$1${additions}`);
  }
  return xml.replace(/(<\/worksheet>)/, `<mergeCells>${additions}</mergeCells>$1`);
}

function updateMergeCount(xml) {
  const count = (xml.match(/<mergeCell /g) || []).length;
  return xml.replace(/<mergeCells count="\d+"/, `<mergeCells count="${count}"`);
}

function updateDimension(xml) {
  const rows = [...xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map((match) => Number(match[1]));
  if (!rows.length) return xml;
  const maxRow = Math.max(...rows);
  return xml.replace(/<dimension ref="([A-Z]+)\d+:([A-Z]+)\d+"\/>/, (_, startCol, endCol) => {
    return `<dimension ref="${startCol}1:${endCol}${maxRow}"/>`;
  });
}

function groupRows(planners, groupId) {
  return planners
    .map((planner) => ({
      name: planner.name || "",
      reason: planner.items?.[groupId]?.reason || ""
    }))
    .filter((entry) => String(entry.reason).trim());
}

function fillRows(xml, col, startRow, rowCount, lines) {
  for (let i = 0; i < rowCount; i += 1) {
    xml = setCellText(xml, `${col}${startRow + i}`, lines[i] || "");
  }
  return xml;
}

function fillSheet(baseXml, planners, header) {
  let xml = baseXml;
  xml = setCellText(xml, "C2", header.district || "●〇地区");
  xml = setCellText(xml, "D2", header.base || "●〇BASE");
  xml = setCellText(xml, "E2", header.auditor || "監査委員●〇");
  xml = setCellText(xml, "M2", header.version || "202608更新");

  let offset = 0;
  for (const group of ITEM_GROUPS) {
    const startRow = group.row + offset;
    const originalEndRow = startRow + group.rows - 1;
    const rows = groupRows(planners, group.id);
    const requiredRows = Math.max(group.rows, rows.length || 1);
    const extraRows = requiredRows - group.rows;

    if (extraRows > 0) {
      const singleRowGroup = group.rows === 1;
      const insertAt = singleRowGroup ? originalEndRow + 1 : originalEndRow;
      const templateRow = rowXmlAt(xml, singleRowGroup ? originalEndRow : originalEndRow - 1) || rowXmlAt(xml, originalEndRow);
      xml = insertRows(xml, insertAt, extraRows, templateRow);
      if (singleRowGroup) xml = extendVerticalMergeEnds(xml, ["I", "J", "K"], originalEndRow, extraRows);
      xml = addRowMerges(xml, Array.from({ length: extraRows }, (_, index) => insertAt + index));
      if (singleRowGroup) xml = addMergeRefs(xml, [`B${startRow}:B${startRow + extraRows}`]);
      offset += extraRows;
    }

    xml = fillRows(xml, "C", startRow, requiredRows, rows.map((entry) => entry.name));
    xml = fillRows(xml, "E", startRow, requiredRows, rows.map((entry) => entry.reason));
    xml = fillRows(xml, "H", startRow, requiredRows, []);
    xml = fillRows(xml, "L", startRow, requiredRows, []);
    xml = fillRows(xml, "M", startRow, requiredRows, []);
  }

  return updateDimension(updateMergeCount(xml.replace(/<sheetView([^>]*) tabSelected="1"/, "<sheetView$1")));
}

async function buildExport(payload) {
  const selected = (payload.planners || []).filter((planner) => planner.selected !== false && planner.name?.trim());
  if (!selected.length) {
    const err = new Error("エクスポート対象のプランナーにチェックを入れてください。");
    err.status = 400;
    throw err;
  }

  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  const baseSheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
  zip.file("xl/worksheets/sheet1.xml", fillSheet(baseSheetXml, selected, payload.header || {}));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/meta") {
      sendJson(res, 200, { items: ITEM_GROUPS });
      return;
    }

    if (req.method === "POST" && req.url === "/api/export") {
      const payload = JSON.parse(await readBody(req));
      const file = await buildExport(payload);
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const filename = encodeURIComponent(`ブロック代表不適合改善報告_${stamp}.xlsx`);
      res.writeHead(200, {
        "content-type": MIME_TYPES[".xlsx"],
        "content-disposition": `attachment; filename*=UTF-8''${filename}`,
        "content-length": file.length
      });
      res.end(file);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Export failed" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Planner report app running at http://${HOST}:${PORT}`);
});
