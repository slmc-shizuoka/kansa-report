const STORAGE_KEY = "planner-report-app:v2";
const LEGACY_STORAGE_KEY = "planner-report-app:v1";

const defaultHeader = {
  district: "●〇地区",
  base: "●〇BASE",
  auditor: "監査委員●〇",
  version: "202608更新"
};

const fieldLabels = {
  all: "すべての文章欄",
  reason: "不適合理由",
  plan: "地区改善計画・策",
  feedback: "フィードバック事項",
  confirmDate: "改善確認日"
};

const importItemColumns = [
  { id: "item01", evaluations: ["①人材獲得_評価"], comments: ["①人材獲得_コメント"] },
  { id: "item02", evaluations: ["②人材品質_評価", "人材品質ロープレ_評価"], comments: ["②人材品質_コメント", "人材品質ロープレ_コメント"] },
  { id: "item03", evaluations: ["③お客様の言葉_評価", "お客様の言葉_評価"], comments: ["③お客様の言葉_コメント", "お客様の言葉_コメント"] },
  { id: "item04", evaluations: ["Windows11_評価", "Windows10_評価"], comments: ["Windows11_コメント", "Windows10_コメント"] },
  { id: "item05", evaluations: ["②教養携帯要件(1)社長の約束_評価"], comments: ["②教養携帯要件(1)社長の約束_コメント"] },
  { id: "item06", evaluations: ["教養携帯要件(3)構造要約書等_評価"], comments: ["教養携帯要件(3)構造要約書等_コメント"] },
  { id: "item07", evaluations: ["@SL系資料_評価", "SL系資料_評価"], comments: ["@SL系資料_コメント", "SL系資料_コメント"] },
  { id: "item08", evaluations: ["【プロの定義】書簡を尊重_評価"], comments: ["【プロの定義】書簡を尊重_コメント"] },
  { id: "item09", evaluations: ["【プロの定義】発刊物を尊重_評価"], comments: ["【プロの定義】発刊物を尊重_コメント"] },
  { id: "item10", evaluations: ["@FAS手帳_評価", "FAS手帳_評価"], comments: ["@FAS手帳_コメント", "FAS手帳_コメント"] },
  { id: "item11", evaluations: ["⑩VTR6_SLS理論_評価", "VTR_SLS必要論_評価"], comments: ["⑩VTR6_SLS理論_コメント", "VTR_SLS必要論_コメント"] },
  { id: "item12", evaluations: ["AO校CODロープレ_評価"], comments: ["AO校CODロープレ_コメント"] },
  { id: "item13", evaluations: ["⑬経営監査(1)_評価"], comments: ["⑬経営監査(1)_コメント"] },
  { id: "item14", evaluations: ["⑭経営監査(2)_評価"], comments: ["⑭経営監査(2)_コメント"] },
  { id: "item15", evaluations: ["⑮経営監査(3)_評価"], comments: ["⑮経営監査(3)_コメント"] },
  { id: "item16", evaluations: ["⑯絶対品質監査_評価"], comments: ["⑯絶対品質監査_コメント"] }
];

const legacyItemMap = {
  item01: "item01",
  item05: "item04",
  item02: "item05",
  item04: "item06",
  item08: "item07",
  item06: "item08",
  item07: "item09",
  item09: "item10",
  item10: "item11",
  item12: "item12"
};

let meta = { items: [] };
let state = {
  header: { ...defaultHeader },
  planners: [],
  snippets: [],
  activeId: null,
  step: 1,
  view: "input",
  formatAppliedAt: null
};

const $ = (selector) => document.querySelector(selector);

function uid() {
  return `planner-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function decodeXml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function emptyItems() {
  return Object.fromEntries(meta.items.map((item) => [item.id, {
    reason: "",
    plan: "",
    feedback: "",
    confirmDate: ""
  }]));
}

function activePlanner() {
  return state.planners.find((planner) => planner.id === state.activeId) || null;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const current = localStorage.getItem(STORAGE_KEY);
  const legacy = current ? null : localStorage.getItem(LEGACY_STORAGE_KEY);
  const saved = current || legacy;
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (legacy) {
      parsed.planners = (parsed.planners || []).map((planner) => {
        const items = {};
        for (const [oldId, newId] of Object.entries(legacyItemMap)) {
          if (planner.items?.[oldId]) items[newId] = planner.items[oldId];
        }
        return { ...planner, items };
      });
      if (parsed.header?.version === "202607更新") parsed.header.version = "202608更新";
    }
    state = {
      header: { ...defaultHeader, ...(parsed.header || {}) },
      planners: Array.isArray(parsed.planners) ? parsed.planners : [],
      snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
      activeId: parsed.activeId || null,
      step: parsed.step || 1,
      view: parsed.view === "format" ? "format" : "input",
      formatAppliedAt: parsed.formatAppliedAt || null
    };
    if (legacy) saveState();
  } catch {
    localStorage.removeItem(current ? STORAGE_KEY : LEGACY_STORAGE_KEY);
  }
}

function normalizePlanner(planner = {}) {
  return {
    id: planner.id || uid(),
    name: planner.name || "",
    selected: planner.selected !== false,
    updatedAt: planner.updatedAt || new Date().toISOString(),
    items: { ...emptyItems(), ...(planner.items || {}) }
  };
}

function normalizeSnippet(snippet = {}) {
  return {
    id: snippet.id || `snippet-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: snippet.name || "",
    field: fieldLabels[snippet.field] ? snippet.field : "all",
    body: snippet.body || "",
    updatedAt: snippet.updatedAt || new Date().toISOString()
  };
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("is-visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("is-visible"), 2200);
}

function markFormatDirty() {
  state.formatAppliedAt = null;
  const status = $("#formatStatus");
  if (status) status.textContent = "未反映";
}

function resetFormatPreview() {
  const preview = $("#formatPreview");
  const status = $("#formatStatus");
  if (!preview || !status) return;
  preview.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "format-empty";
  const heading = document.createElement("strong");
  heading.textContent = "反映ボタンを押すと、入力内容がここに表示されます";
  const detail = document.createElement("span");
  detail.textContent = "エクスポート前の確認に使えます";
  empty.append(heading, detail);
  preview.append(empty);
  status.textContent = "未反映";
}

function ensurePlanner() {
  if (!state.planners.length) {
    const planner = normalizePlanner();
    state.planners.push(planner);
    state.activeId = planner.id;
  }
}

function setStep(step) {
  state.step = step;
  $("#plannerStep").hidden = step !== 1;
  $("#detailStep").hidden = step !== 2;
  $("#stepOne").classList.toggle("is-active", step === 1);
  $("#stepTwo").classList.toggle("is-active", step === 2);
  saveState();
}

function setView(view) {
  state.view = view === "format" ? "format" : "input";
  const isInput = state.view === "input";
  $("#inputView").hidden = !isInput;
  $("#formatView").hidden = isInput;
  $("#showInputTab").classList.toggle("is-active", isInput);
  $("#showFormatTab").classList.toggle("is-active", !isInput);
  $("#showInputTab").setAttribute("aria-selected", String(isInput));
  $("#showFormatTab").setAttribute("aria-selected", String(!isInput));
  saveState();
}

function renderPlannerList() {
  const list = $("#plannerList");
  const selected = state.planners.filter((planner) => planner.selected).length;
  $("#selectedCount").textContent = `${selected}/${state.planners.length}`;

  list.innerHTML = "";
  for (const planner of state.planners) {
    const row = document.createElement("div");
    row.className = `planner-row${planner.id === state.activeId ? " is-active" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = planner.selected;
    checkbox.addEventListener("change", () => {
      planner.selected = checkbox.checked;
      planner.updatedAt = new Date().toISOString();
      saveState();
      renderPlannerList();
    });

    const nameButton = document.createElement("button");
    nameButton.className = "planner-name";
    nameButton.textContent = planner.name || "氏名未入力";
    nameButton.title = planner.name || "氏名未入力";
    nameButton.addEventListener("click", () => {
      state.activeId = planner.id;
      state.step = planner.name ? 2 : 1;
      state.formatAppliedAt = null;
      saveState();
      render();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-planner";
    deleteButton.textContent = "×";
    deleteButton.title = "削除";
    deleteButton.addEventListener("click", () => {
      state.planners = state.planners.filter((item) => item.id !== planner.id);
      if (state.activeId === planner.id) {
        state.activeId = state.planners[0]?.id || null;
        state.formatAppliedAt = null;
      }
      ensurePlanner();
      saveState();
      render();
    });

    row.append(checkbox, nameButton, deleteButton);
    list.append(row);
  }
}

function bindHeader() {
  for (const key of ["district", "base", "auditor", "version"]) {
    const input = $(`#${key}`);
    input.value = state.header[key] || "";
  }
}

function renderSettingsSummary() {
  $("#summaryDistrict").textContent = state.header.district || "未設定";
  $("#summaryBase").textContent = state.header.base || "未設定";
  $("#summaryAuditor").textContent = state.header.auditor || "未設定";
}

function openSettings() {
  bindHeader();
  $("#settingsDialog").showModal();
  $("#district").focus();
}

function saveSettings() {
  for (const key of ["district", "base", "auditor", "version"]) {
    state.header[key] = $(`#${key}`).value.trim();
  }
  markFormatDirty();
  saveState();
  renderSettingsSummary();
  $("#settingsDialog").close();
  toast("設定を保存しました");
}

function resetSettings() {
  state.header = { ...defaultHeader };
  bindHeader();
  markFormatDirty();
  saveState();
  renderSettingsSummary();
  toast("初期値に戻しました");
}

async function writeClipboard(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
    return true;
  } catch {
    toast("クリップボードへコピーできませんでした");
    return false;
  }
}

async function readClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    toast("クリップボードの読み取りを許可してください");
    return null;
  }
}

function insertText(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const separator = before && !before.endsWith("\n") && text ? "\n" : "";
  input.value = `${before}${separator}${text}${after}`;
  const cursor = before.length + separator.length + text.length;
  input.setSelectionRange(cursor, cursor);
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function snippetOptions(field) {
  return state.snippets.filter((snippet) => snippet.field === "all" || snippet.field === field);
}

function fieldMarkup(item, field, label, type = "textarea") {
  const inputId = `field-${item.id}-${field}`;
  const snippets = field === "confirmDate" ? "" : `
    <select class="snippet-picker" data-action="insert-snippet" data-field="${field}" aria-label="${label}に定型文を挿入">
      <option value="">定型文を挿入</option>
      ${snippetOptions(field).map((snippet) => `<option value="${snippet.id}"></option>`).join("")}
    </select>
  `;
  const control = type === "input"
    ? `<input id="${inputId}" data-field="${field}" data-id="${item.id}" type="text" placeholder="YYYY/MM/DD">`
    : `<textarea id="${inputId}" data-field="${field}" data-id="${item.id}" spellcheck="false"></textarea>`;

  return `
    <div class="input-block">
      <div class="field-head">
        <label for="${inputId}">${label}</label>
        <div class="field-tools">
          ${snippets}
          <button class="field-tool" data-action="copy-field" data-field="${field}" type="button">コピー</button>
          <button class="field-tool" data-action="paste-field" data-field="${field}" type="button">貼付</button>
        </div>
      </div>
      ${control}
    </div>
  `;
}

function hydrateSnippetPickers(card) {
  for (const picker of card.querySelectorAll('[data-action="insert-snippet"]')) {
    const options = snippetOptions(picker.dataset.field);
    picker.querySelectorAll("option").forEach((option, index) => {
      if (index > 0) option.textContent = options[index - 1]?.name || "";
    });
  }
}

function updateItemCard(card, values) {
  for (const input of card.querySelectorAll("[data-field][data-id]")) {
    input.value = values[input.dataset.field] || "";
  }
}

function filledItemCount(planner) {
  if (!planner) return 0;
  return meta.items.filter((item) => {
    const values = planner.items[item.id] || {};
    return String(values.reason || "").trim();
  }).length;
}

function selectedPlanners() {
  return state.planners.filter((planner) => planner.selected && planner.name.trim());
}

function cell(text, className = "") {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text || "";
  return td;
}

function renderFormatPreview(options = {}) {
  const shouldPersist = options.persist === true;
  const planners = selectedPlanners();
  const preview = $("#formatPreview");
  const status = $("#formatStatus");
  preview.innerHTML = "";

  if (!planners.length) {
    const empty = document.createElement("div");
    empty.className = "format-empty";
    const heading = document.createElement("strong");
    heading.textContent = "反映するプランナーにチェックを入れてください";
    const detail = document.createElement("span");
    detail.textContent = "チェック済みのプランナー全員が確認表に入ります";
    empty.append(heading, detail);
    preview.append(empty);
    status.textContent = "未反映";
    return;
  }

  const header = document.createElement("div");
  header.className = "report-header";
  const title = document.createElement("h2");
  title.textContent = "ブロック代表不適合改善報告";
  const metaRow = document.createElement("div");
  metaRow.className = "report-meta";
  for (const value of [state.header.district, state.header.base, state.header.auditor, state.header.version]) {
    const badge = document.createElement("span");
    badge.textContent = value || "";
    metaRow.append(badge);
  }
  header.append(title, metaRow);

  const tableWrap = document.createElement("div");
  tableWrap.className = "report-table-wrap";
  const table = document.createElement("table");
  table.className = "report-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["項目", "対象プランナー", "不適合理由", "地区改善計画・策", "7月CCR", "8月CCR", "9月暫定CCR", "フィードバック事項", "改善確認日"]) {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  for (const item of meta.items) {
    const itemRows = planners
      .map((planner) => ({
        name: planner.name,
        reason: planner.items[item.id]?.reason || ""
      }))
      .filter((entry) => String(entry.reason).trim());
    const rows = itemRows.length ? itemRows : [{ name: "", reason: "" }];
    for (const [plannerIndex, entry] of rows.entries()) {
      const row = document.createElement("tr");
      if (plannerIndex === 0) {
        const itemCell = cell(item.label, "item-name");
        itemCell.rowSpan = rows.length;
        row.append(itemCell);
      }
      row.append(
        cell(entry.name, "planner-cell"),
        cell(entry.reason, "text-cell"),
        cell("", "text-cell"),
        cell("", "ccr-cell"),
        cell("", "ccr-cell"),
        cell("", "ccr-cell"),
        cell("", "text-cell feedback-cell"),
        cell("", "date-cell")
      );
      tbody.append(row);
    }
  }

  table.append(thead, tbody);
  tableWrap.append(table);
  preview.append(header, tableWrap);

  if (shouldPersist) state.formatAppliedAt = new Date().toISOString();
  const totalFilled = planners.reduce((sum, planner) => sum + filledItemCount(planner), 0);
  status.textContent = `${planners.length}名 / ${totalFilled}件反映`;
  if (shouldPersist) {
    saveState();
    toast("フォーマットに反映しました");
  }
}

function itemPayload(item, values) {
  return JSON.stringify({
    type: "planner-report-item",
    item: { id: item.id, label: item.label },
    values: {
      reason: values.reason || ""
    }
  }, null, 2);
}

function parseItemClipboard(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("貼り付ける内容がありません");

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const source = parsed.values || parsed.item?.values || parsed;
    return {
      reason: source.reason || "",
      plan: "",
      feedback: "",
      confirmDate: ""
    };
  }

  const columns = text.split(/\t/);
  if (columns.length >= 1) {
    return {
      reason: columns[0] || "",
      plan: "",
      feedback: "",
      confirmDate: ""
    };
  }

  throw new Error("項目コピーした内容、または不適合理由のテキストを貼り付けてください");
}

function renderItems(planner) {
  const list = $("#itemList");
  list.innerHTML = "";
  for (const item of meta.items) {
    const values = planner.items[item.id] || {};
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-title">
        <div class="item-heading"><strong>${item.label}</strong><span>${item.rows}行</span></div>
        <div class="item-actions">
          <button data-action="copy-item" type="button">項目コピー</button>
          <button data-action="paste-item" type="button">項目貼付</button>
        </div>
      </div>
      <div class="item-fields reason-only">
        ${fieldMarkup(item, "reason", fieldLabels.reason)}
      </div>
    `;
    hydrateSnippetPickers(card);
    updateItemCard(card, values);

    for (const input of card.querySelectorAll("[data-field]")) {
      if (!input.matches("input, textarea")) continue;
      input.value = values[input.dataset.field] || "";
      input.addEventListener("input", () => {
        planner.items[item.id][input.dataset.field] = input.value;
        planner.updatedAt = new Date().toISOString();
        markFormatDirty();
        saveState();
      });
    }

    card.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;

      if (action === "copy-item") {
        await writeClipboard(itemPayload(item, planner.items[item.id]), `${item.label}をコピーしました`);
      }

      if (action === "paste-item") {
        const text = await readClipboard();
        if (text === null) return;
        try {
          planner.items[item.id] = parseItemClipboard(text);
          planner.updatedAt = new Date().toISOString();
          markFormatDirty();
          saveState();
          updateItemCard(card, planner.items[item.id]);
          toast(`${item.label}に貼り付けました`);
        } catch (error) {
          toast(error.message || "項目を貼り付けできませんでした");
        }
      }

      if (action === "copy-field") {
        const input = card.querySelector(`[data-id="${item.id}"][data-field="${button.dataset.field}"]`);
        await writeClipboard(input?.value || "", `${fieldLabels[button.dataset.field]}をコピーしました`);
      }

      if (action === "paste-field") {
        const text = await readClipboard();
        if (text === null) return;
        const input = card.querySelector(`[data-id="${item.id}"][data-field="${button.dataset.field}"]`);
        if (input) insertText(input, text);
        toast(`${fieldLabels[button.dataset.field]}に貼り付けました`);
      }
    });

    card.addEventListener("change", (event) => {
      const picker = event.target.closest('[data-action="insert-snippet"]');
      if (!picker?.value) return;
      const snippet = state.snippets.find((entry) => entry.id === picker.value);
      const input = card.querySelector(`[data-id="${item.id}"][data-field="${picker.dataset.field}"]`);
      if (snippet && input) {
        insertText(input, snippet.body);
        toast(`「${snippet.name}」を挿入しました`);
      }
      picker.value = "";
    });

    list.append(card);
  }
}

function renderSnippetList() {
  const list = $("#snippetList");
  $("#snippetCount").textContent = state.snippets.length;
  list.innerHTML = "";

  if (!state.snippets.length) {
    const empty = document.createElement("p");
    empty.className = "empty-snippets";
    empty.textContent = "保存した定型文がここに表示されます";
    list.append(empty);
    return;
  }

  for (const snippet of state.snippets) {
    const row = document.createElement("article");
    row.className = "snippet-row";

    const content = document.createElement("div");
    content.className = "snippet-content";

    const heading = document.createElement("div");
    heading.className = "snippet-heading";
    const name = document.createElement("strong");
    name.textContent = snippet.name;
    const field = document.createElement("span");
    field.textContent = fieldLabels[snippet.field];
    heading.append(name, field);

    const body = document.createElement("p");
    body.textContent = snippet.body;
    content.append(heading, body);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-snippet";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.title = "定型文を削除";
    deleteButton.setAttribute("aria-label", `「${snippet.name}」を削除`);
    deleteButton.addEventListener("click", () => {
      state.snippets = state.snippets.filter((entry) => entry.id !== snippet.id);
      saveState();
      renderSnippetList();
      const planner = activePlanner();
      if (planner && state.step === 2) renderItems(planner);
      toast("定型文を削除しました");
    });

    row.append(content, deleteButton);
    list.append(row);
  }
}

function saveSnippet() {
  const nameInput = $("#snippetName");
  const bodyInput = $("#snippetBody");
  const body = bodyInput.value.trim();
  const name = nameInput.value.trim() || body.slice(0, 18);

  if (!body) {
    toast("定型文の本文を入力してください");
    bodyInput.focus();
    return;
  }

  state.snippets.unshift(normalizeSnippet({
    name,
    field: $("#snippetField").value,
    body
  }));
  saveState();
  nameInput.value = "";
  bodyInput.value = "";
  $("#snippetField").value = "all";
  renderSnippetList();
  const planner = activePlanner();
  if (planner && state.step === 2) renderItems(planner);
  toast("定型文を保存しました");
  nameInput.focus();
}

function renderEditor() {
  const planner = activePlanner();
  $("#plannerName").value = planner?.name || "";
  bindHeader();
  renderSettingsSummary();
  if (planner) renderItems(planner);
  setStep(state.step);
  setView(state.view);
  if (!state.formatAppliedAt) resetFormatPreview();
}

function render() {
  ensurePlanner();
  renderPlannerList();
  renderEditor();
  renderSnippetList();
}

function createPlanner() {
  const planner = normalizePlanner();
  state.planners.unshift(planner);
  state.activeId = planner.id;
  state.step = 1;
  state.formatAppliedAt = null;
  saveState();
  render();
  $("#plannerName").focus();
}

function saveActivePlanner(options = {}) {
  const planner = activePlanner();
  if (!planner) return;
  planner.name = $("#plannerName").value.trim();
  planner.updatedAt = new Date().toISOString();
  if (planner.name) state.step = 2;
  if (options.resetFormat !== false) markFormatDirty();
  saveState();
  render();
  if (!options.silent) toast("保存しました");
}

function plannerToTsv(planner) {
  const rows = [["項目", "不適合理由", "地区改善計画・策", "フィードバック事項", "改善確認日"]];
  for (const item of meta.items) {
    const values = planner.items[item.id] || {};
    rows.push([item.label, values.reason || "", values.plan || "", values.feedback || "", values.confirmDate || ""]);
  }
  return rows.map((row) => row.map((cell) => String(cell).replace(/\t/g, " ").replace(/\r?\n/g, " / ")).join("\t")).join("\n");
}

async function copyData() {
  const planner = activePlanner();
  if (!planner) return;
  const payload = {
    header: state.header,
    planner: {
      name: $("#plannerName").value.trim() || planner.name,
      items: planner.items
    },
    tsv: plannerToTsv(planner)
  };
  await writeClipboard(JSON.stringify(payload, null, 2), "プランナー全体をコピーしました");
}

function applyParsedPlanner(parsed) {
  const planner = activePlanner();
  if (!planner) return;
  const source = parsed.planner || parsed;
  if (source.name) planner.name = source.name;
  if (parsed.header) state.header = { ...state.header, ...parsed.header };
  if (source.items) {
    planner.items = { ...emptyItems(), ...source.items };
  }
  markFormatDirty();
  planner.updatedAt = new Date().toISOString();
}

function parseTsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const planner = activePlanner();
  if (!planner || lines.length < 2) throw new Error("TSVの行が足りません");
  const nextItems = { ...planner.items };
  for (const line of lines.slice(1)) {
    const [label, reason, plan, feedback, confirmDate] = line.split("\t");
    const item = meta.items.find((entry) => label.includes(entry.label.slice(0, 3)) || entry.label.includes(label.slice(0, 3)));
    if (!item) continue;
    nextItems[item.id] = { reason: reason || "", plan: plan || "", feedback: feedback || "", confirmDate: confirmDate || "" };
  }
  planner.items = { ...emptyItems(), ...nextItems };
  markFormatDirty();
  planner.updatedAt = new Date().toISOString();
}

function applyPasteText(text) {
  if (!text.trim()) return;
  try {
    if (text.trim().startsWith("{")) {
      applyParsedPlanner(JSON.parse(text));
    } else {
      parseTsv(text);
    }
    state.step = 2;
    saveState();
    render();
    toast("貼り付けました");
  } catch (error) {
    toast(error.message || "貼り付けできませんでした");
  }
}

function normalizeHeader(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function xlsxCellValue(cellXml, sharedStrings) {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1];
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (type === "s") return sharedStrings[Number(value)] || "";
  const inline = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/)?.[1];
  return decodeXml(inline ?? value ?? "");
}

function parseSharedStrings(xml = "") {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => {
    return [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]))
      .join("");
  });
}

async function readFirstWorksheet(zip) {
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const firstSheet = workbookXml.match(/<sheet[^>]*r:id="([^"]+)"/);
  if (!firstSheet) throw new Error("Excelシートを読み取れませんでした");
  const relMap = Object.fromEntries([...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((match) => [match[1], match[2]]));
  const target = relMap[firstSheet[1]]?.replace(/^\//, "").replace(/^xl\//, "");
  if (!target) throw new Error("Excelシートの参照を読み取れませんでした");
  return zip.file(`xl/${target}`).async("string");
}

function rowsFromSheetXml(sheetXml, sharedStrings) {
  return [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells = {};
    for (const cell of row[2].matchAll(/<c\b[^>]*\br="([A-Z]+)(\d+)"[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\br="([A-Z]+)(\d+)"[^>]*\/>/g)) {
      cells[cell[1] || cell[3]] = xlsxCellValue(cell[0], sharedStrings).trim();
    }
    return cells;
  });
}

function columnByHeader(headerRow, label) {
  const target = normalizeHeader(label);
  return Object.entries(headerRow).find(([, value]) => normalizeHeader(value) === target)?.[0] || "";
}

function columnByHeaders(headerRow, labels) {
  for (const label of labels) {
    const column = columnByHeader(headerRow, label);
    if (column) return column;
  }
  return "";
}

function importedPlannerFromRow(row, columns) {
  const name = row[columns.name]?.trim();
  if (!name) return null;
  const items = emptyItems();
  let importedCount = 0;
  for (const item of importItemColumns) {
    const evalCol = columns.items[item.id]?.evaluation;
    const commentCol = columns.items[item.id]?.comment;
    const evaluation = row[evalCol]?.trim().toUpperCase();
    if (["C", "D"].includes(evaluation)) {
      items[item.id] = {
        ...items[item.id],
        reason: commentCol ? row[commentCol] || "" : ""
      };
      importedCount += 1;
    }
  }
  if (!importedCount) return null;
  return normalizePlanner({ name, selected: true, items });
}

async function parseImportWorkbook(file) {
  if (!window.JSZip) throw new Error("Excel読取ライブラリを読み込めませんでした");
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsFile ? parseSharedStrings(await sharedStringsFile.async("string")) : [];
  const rows = rowsFromSheetXml(await readFirstWorksheet(zip), sharedStrings).filter((row) => Object.keys(row).length);
  if (!rows.length) throw new Error("Excelにデータがありません");

  const headerRow = rows[0];
  const columns = {
    name: columnByHeader(headerRow, "氏名"),
    items: Object.fromEntries(importItemColumns.map((item) => [item.id, {
      evaluation: columnByHeaders(headerRow, item.evaluations),
      comment: columnByHeaders(headerRow, item.comments)
    }]))
  };
  const missing = [
    !columns.name && "氏名",
    !Object.values(columns.items).some((item) => item.evaluation) && "評価列"
  ].filter(Boolean);
  if (missing.length) throw new Error(`列が見つかりません: ${missing.slice(0, 3).join("、")}${missing.length > 3 ? "…" : ""}`);

  return rows.slice(1)
    .map((row) => importedPlannerFromRow(row, columns))
    .filter(Boolean);
}

async function parseImportPdf(file) {
  const { parseSmartHrPdf } = await import("/pdf-import.js");
  const parsed = await parseSmartHrPdf(file);
  const items = emptyItems();
  let importedCount = 0;

  for (const item of parsed.items) {
    if (!["C", "D"].includes(item.evaluation)) continue;
    items[item.id] = { ...items[item.id], reason: item.comment || "" };
    importedCount += 1;
  }

  if (!importedCount) return [];
  return [normalizePlanner({ name: parsed.name, selected: true, items })];
}

async function parseImportFile(file) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return parseImportPdf(file);
  if (/\.xlsx$/i.test(file.name)) return parseImportWorkbook(file);
  throw new Error("PDFまたはExcel（.xlsx）を選択してください");
}

async function importReportFile(file) {
  if (!file) return;
  $("#importReport").disabled = true;
  try {
    const imported = await parseImportFile(file);
    if (!imported.length) {
      toast("評価C/Dの項目がありません");
      return;
    }

    let added = 0;
    let updated = 0;
    const importedNames = new Set(imported.map((planner) => planner.name.trim()));
    state.planners.forEach((planner) => {
      if (!importedNames.has(planner.name.trim())) planner.selected = false;
    });
    for (const planner of imported) {
      const existing = state.planners.find((entry) => entry.name.trim() === planner.name.trim());
      if (existing) {
        existing.items = planner.items;
        existing.selected = true;
        existing.updatedAt = new Date().toISOString();
        updated += 1;
      } else {
        state.planners.unshift(planner);
        added += 1;
      }
    }
    state.activeId = imported[0].id;
    const active = state.planners.find((planner) => planner.name === imported[0].name);
    if (active) state.activeId = active.id;
    state.step = 2;
    markFormatDirty();
    saveState();
    render();
    toast(`${imported.length}名をインポートしました（追加${added} / 更新${updated}）`);
  } catch (error) {
    toast(error.message || "インポートできませんでした");
  } finally {
    $("#importReport").disabled = false;
    $("#importFile").value = "";
  }
}

async function exportXlsx() {
  saveActivePlanner();
  const selected = state.planners.filter((planner) => planner.selected && planner.name.trim());
  if (!selected.length) {
    toast("対象にチェックを入れてください");
    return;
  }

  $("#exportXlsx").disabled = true;
  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ header: state.header, planners: state.planners })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "エクスポートできませんでした");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    link.href = url;
    link.download = `ブロック代表不適合改善報告_${stamp}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`${selected.length}名を出力しました`);
  } catch (error) {
    toast(error.message || "エクスポートできませんでした");
  } finally {
    $("#exportXlsx").disabled = false;
  }
}

function bindEvents() {
  $("#newPlanner").addEventListener("click", createPlanner);
  $("#continueInput").addEventListener("click", saveActivePlanner);
  $("#savePlanner").addEventListener("click", saveActivePlanner);
  $("#exportXlsx").addEventListener("click", exportXlsx);
  $("#importReport").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (event) => importReportFile(event.target.files?.[0]));
  $("#copyData").addEventListener("click", copyData);
  $("#showInputTab").addEventListener("click", () => setView("input"));
  $("#showFormatTab").addEventListener("click", () => setView("format"));
  $("#openSettings").addEventListener("click", openSettings);
  $("#editSettingsInline").addEventListener("click", openSettings);
  $("#closeSettings").addEventListener("click", () => $("#settingsDialog").close());
  $("#saveSettings").addEventListener("click", saveSettings);
  $("#resetSettings").addEventListener("click", resetSettings);
  $("#settingsDialog").addEventListener("click", (event) => {
    if (event.target === $("#settingsDialog")) $("#settingsDialog").close();
  });
  $("#applyFormat").addEventListener("click", () => {
    saveActivePlanner({ resetFormat: false, silent: true });
    setView("format");
    renderFormatPreview({ persist: true });
  });
  $("#openSnippets").addEventListener("click", () => {
    renderSnippetList();
    $("#snippetDialog").showModal();
    $("#snippetName").focus();
  });
  $("#closeSnippets").addEventListener("click", () => $("#snippetDialog").close());
  $("#saveSnippet").addEventListener("click", saveSnippet);
  $("#snippetDialog").addEventListener("click", (event) => {
    if (event.target === $("#snippetDialog")) $("#snippetDialog").close();
  });
  $("#togglePaste").addEventListener("click", async () => {
    const tray = $("#pasteTray");
    tray.hidden = !tray.hidden;
    if (!tray.hidden) {
      $("#pasteBox").focus();
      try {
        $("#pasteBox").value = await navigator.clipboard.readText();
      } catch {
        $("#pasteBox").value = "";
      }
    }
  });
  $("#applyPaste").addEventListener("click", () => applyPasteText($("#pasteBox").value));
  $("#clearPaste").addEventListener("click", () => {
    $("#pasteBox").value = "";
  });
  $("#plannerName").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveActivePlanner();
  });
}

async function init() {
  const response = await fetch("/api/meta");
  meta = await response.json();
  loadState();
  state.planners = state.planners.map(normalizePlanner);
  state.snippets = state.snippets.map(normalizeSnippet);
  ensurePlanner();
  bindEvents();
  render();
}

init();
