const ITEM_HEADINGS = [
  /人材獲得/,
  /人材品質.*ロープレ/,
  /お客様の言葉/,
  /生活安全品質.*Windows10/i,
  /1204/,
  /構造要約書/,
  /SL.*系資料/i,
  /公開情報.*書簡/,
  /公開情報.*発刊物/,
  /FAS/i,
  /VTR.*SLS.*必要論/i,
  /AO.*校.*ロープレ/i,
  /経営監査.*1.*人材獲得競争/,
  /経営監査.*2.*SLD普及活動/i,
  /経営監査.*3.*お客様.*話/,
  /絶対品質監査.*文化の監査/
];

const REQUIRED_ITEM_COUNT = 12;

const KANGXI_EQUIVALENTS = [..."一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳心戈戶手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨靑非面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠"];
const SUPPLEMENT_EQUIVALENTS = { "⻑": "長", "⻘": "青" };

const COMMENT_MIN_X = 270;
const COMMENT_MAX_X = 600;
const EVALUATION_MIN_X = 680;
const EVALUATION_MAX_X = 810;

function normalizeGlyphs(value) {
  return [...String(value || "")].map((character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint >= 0x2f00 && codePoint <= 0x2fd5) {
      return KANGXI_EQUIVALENTS[codePoint - 0x2f00] || character;
    }
    return SUPPLEMENT_EQUIVALENTS[character] || character;
  }).join("");
}

function normalized(value) {
  return normalizeGlyphs(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

function joinPieces(pieces) {
  let text = "";
  let previousEnd = null;
  for (const piece of pieces) {
    const value = normalizeGlyphs(piece.text).trim();
    if (!value) continue;
    const gap = previousEnd === null ? 0 : piece.x - previousEnd;
    text += `${text && gap > 3 ? " " : ""}${value}`;
    previousEnd = piece.x + (piece.width || 0);
  }
  return text.trim();
}

function pageLines(page) {
  const rows = [];
  for (const item of page.items || []) {
    const text = String(item.str || "").trim();
    if (!text || !item.transform) continue;
    const x = Number(item.transform[4]) || 0;
    const y = Number(item.transform[5]) || 0;
    let row = rows.find((entry) => Math.abs(entry.y - y) <= 2.5);
    if (!row) {
      row = { y, pieces: [] };
      rows.push(row);
    }
    row.pieces.push({ text, x, width: Number(item.width) || 0 });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      row.pieces.sort((a, b) => a.x - b.x);
      return { ...row, text: joinPieces(row.pieces) };
    });
}

function isTableHeader(text) {
  const value = normalized(text);
  return value.includes("監査員コメント") && value.includes("評価選択");
}

function isTableEnd(text) {
  const value = normalized(text);
  return value.includes("エンゲージメント") || value.includes("自由記述欄") || value.includes("総合評価・フッター");
}

function headingIndex(text, expectedIndex) {
  if (expectedIndex < 0 || expectedIndex >= ITEM_HEADINGS.length) return -1;
  return ITEM_HEADINGS[expectedIndex].test(normalized(text)) ? expectedIndex : -1;
}

export function parseSmartHrPages(pages) {
  const results = ITEM_HEADINGS.map((_, index) => ({
    id: `item${String(index + 1).padStart(2, "0")}`,
    evaluation: "",
    commentLines: []
  }));

  let name = "";
  let currentItem = -1;
  let nextHeading = 0;
  let inTable = false;

  for (const page of pages) {
    for (const line of pageLines(page)) {
      const lineText = normalized(line.text);
      if (!name) {
        const match = lineText.match(/^(.+?)さんの【/);
        if (match) name = match[1].trim();
      }

      const foundHeading = headingIndex(lineText, nextHeading);
      if (foundHeading >= 0) {
        currentItem = foundHeading;
        nextHeading += 1;
        inTable = false;
        continue;
      }

      if (isTableHeader(lineText)) {
        inTable = currentItem >= 0;
        continue;
      }
      if (isTableEnd(lineText)) {
        inTable = false;
        continue;
      }
      if (!inTable || currentItem < 0) continue;

      const evaluationPiece = line.pieces.find((piece) => {
        return piece.x >= EVALUATION_MIN_X && piece.x < EVALUATION_MAX_X && /^[ABCD]$/i.test(normalized(piece.text));
      });
      if (evaluationPiece && !results[currentItem].evaluation) {
        results[currentItem].evaluation = normalized(evaluationPiece.text).toUpperCase();
      }

      const comment = joinPieces(line.pieces.filter((piece) => {
        return piece.x >= COMMENT_MIN_X && piece.x < COMMENT_MAX_X;
      }));
      if (comment) results[currentItem].commentLines.push(comment);
    }
  }

  if (!name) throw new Error("PDFから対象プランナー名を読み取れませんでした");
  if (nextHeading < REQUIRED_ITEM_COUNT) {
    throw new Error(`PDFの監査項目を読み取れませんでした（${nextHeading}/${REQUIRED_ITEM_COUNT}項目）`);
  }

  return {
    name,
    items: results.map(({ id, evaluation, commentLines }) => ({
      id,
      evaluation,
      comment: commentLines.join("\n").trim()
    }))
  };
}

export async function parseSmartHrPdf(file) {
  const pdfjs = await import("/vendor/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    pages.push({
      height: viewport.height,
      items: textContent.items.map((item) => ({
        str: item.str,
        transform: item.transform,
        width: item.width,
        height: item.height
      }))
    });
    page.cleanup();
  }

  await loadingTask.destroy();
  return parseSmartHrPages(pages);
}
