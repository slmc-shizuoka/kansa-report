import { buildExport } from "../_shared/report.js";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function onRequestPost({ request }) {
  try {
    const payload = await request.json();
    const templateResponse = await fetch(new URL("/template/report-template.xlsx", request.url));
    if (!templateResponse.ok) throw new Error("Excelテンプレートを読み込めませんでした。");

    const file = await buildExport(payload, await templateResponse.arrayBuffer());
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = encodeURIComponent(`ブロック代表不適合改善報告_${stamp}.xlsx`);

    return new Response(file, {
      headers: {
        "content-type": XLSX_TYPE,
        "content-disposition": `attachment; filename*=UTF-8''${filename}`
      }
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Export failed" },
      { status: error.status || 500 }
    );
  }
}
