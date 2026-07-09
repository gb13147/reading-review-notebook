const STORAGE_KEY = "morphic-media-diary-v1";
const ASSET_DB = "morphic-media-assets-v1";

const state = loadState();
let activeId = state.activeId || state.entries[0]?.id || null;
let viewDate = activeEntry()?.date ? new Date(activeEntry().date) : new Date();
let spreadIndex = 0;
let soundOn = state.settings.soundOn ?? true;
let soundKind = state.settings.soundKind || "soft";
let lastRange = null;
let selectedMediaId = null;
let selectedBlockId = null;

const el = {
  newEntryButton: document.querySelector("#newEntryButton"),
  emptyNewButton: document.querySelector("#emptyNewButton"),
  searchInput: document.querySelector("#searchInput"),
  calendarGrid: document.querySelector("#calendarGrid"),
  monthLabel: document.querySelector("#monthLabel"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  entryList: document.querySelector("#entryList"),
  entryCount: document.querySelector("#entryCount"),
  currentEntryTitle: document.querySelector("#currentEntryTitle"),
  soundToggleButton: document.querySelector("#soundToggleButton"),
  soundSelect: document.querySelector("#soundSelect"),
  backupButton: document.querySelector("#backupButton"),
  deleteEntryButton: document.querySelector("#deleteEntryButton"),
  emptyState: document.querySelector("#emptyState"),
  journalDesk: document.querySelector("#journalDesk"),
  editorPanel: document.querySelector("#editorPanel"),
  prevPageButton: document.querySelector("#prevPageButton"),
  nextPageButton: document.querySelector("#nextPageButton"),
  pageLabel: document.querySelector("#pageLabel"),
  bookStage: document.querySelector("#bookStage"),
  leftPage: document.querySelector("#leftPage"),
  rightPage: document.querySelector("#rightPage"),
  turnPage: document.querySelector("#turnPage"),
  titleInput: document.querySelector("#titleInput"),
  dateInput: document.querySelector("#dateInput"),
  timeInput: document.querySelector("#timeInput"),
  tagsInput: document.querySelector("#tagsInput"),
  backgroundSelect: document.querySelector("#backgroundSelect"),
  photoBackgroundField: document.querySelector("#photoBackgroundField"),
  backgroundImageInput: document.querySelector("#backgroundImageInput"),
  editor: document.querySelector("#editor"),
  imageInput: document.querySelector("#imageInput"),
  audioInput: document.querySelector("#audioInput"),
  videoInput: document.querySelector("#videoInput"),
  insertSceneButton: document.querySelector("#insertSceneButton"),
  deleteSelectedButton: document.querySelector("#deleteSelectedButton"),
  sceneDialog: document.querySelector("#sceneDialog"),
  saveHint: document.querySelector("#saveHint"),
  contextMenu: null
};

function seedEntries() {
  const now = new Date();
  return [{
    id: uid(),
    title: "第一篇感想",
    date: toDateInput(now),
    time: toTimeInput(now),
    tags: ["样例", "回忆"],
    background: "paper",
    backgroundImage: "",
    content: `<h2>今天想记录什么？</h2><p>这里可以像写日记一样自由排版。把光标放在任意位置，然后插入图片、音乐、视频或动态场景。</p><blockquote>这不是普通笔记，而是一本可以翻页的电子手账。</blockquote>`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }];
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.entries?.length) return saved;
  } catch {}
  return {
    entries: seedEntries(),
    activeId: null,
    settings: { soundOn: true, soundKind: "soft" }
  };
}

function saveState() {
  state.activeId = activeId;
  state.settings.soundOn = soundOn;
  state.settings.soundKind = soundKind;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    el.saveHint.textContent = "已自动保存";
  } catch (error) {
    el.saveHint.textContent = "素材太大，已显示但建议用较小文件";
    console.warn("保存失败", error);
  }
}

function uid() {
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeEntry() {
  return state.entries.find((entry) => entry.id === activeId) || state.entries[0] || null;
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function toTimeInput(date) {
  return date.toTimeString().slice(0, 5);
}

function formatDate(date, time) {
  const d = date ? new Date(`${date}T${time || "00:00"}`) : new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${time || ""}`.trim();
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || "";
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function createEntry() {
  const now = new Date();
  const entry = {
    id: uid(),
    title: "未命名感想",
    date: toDateInput(now),
    time: toTimeInput(now),
    tags: [],
    background: "paper",
    backgroundImage: "",
    content: "<p>写下此刻的感想...</p>",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  state.entries.unshift(entry);
  activeId = entry.id;
  viewDate = new Date(entry.date);
  spreadIndex = 0;
  saveState();
  render();
  el.editor.focus();
}

function updateActive(patch) {
  const entry = activeEntry();
  if (!entry) return;
  Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
  saveState();
  render(false);
}

function deleteActive() {
  const entry = activeEntry();
  if (!entry) return;
  if (!confirm(`确定删除「${entry.title || "未命名感想"}」吗？`)) return;
  state.entries = state.entries.filter((item) => item.id !== entry.id);
  activeId = state.entries[0]?.id || null;
  spreadIndex = 0;
  saveState();
  render();
}

function filteredEntries() {
  const keyword = el.searchInput.value.trim().toLowerCase();
  const entries = [...state.entries].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  if (!keyword) return entries;
  return entries.filter((entry) => [
    entry.title,
    entry.date,
    entry.time,
    (entry.tags || []).join(" "),
    stripHtml(entry.content)
  ].join(" ").toLowerCase().includes(keyword));
}

function render(restoreEditor = true) {
  if (!activeId && state.entries.length) activeId = state.entries[0].id;
  renderList();
  renderCalendar();
  renderDetail(restoreEditor);
}

function renderList() {
  const entries = filteredEntries();
  el.entryCount.textContent = `${entries.length} 篇`;
  if (!entries.length) {
    el.entryList.innerHTML = `<div class="empty-mini">没有找到记录</div>`;
    return;
  }
  el.entryList.innerHTML = entries.map((entry) => `
    <button class="entry-item ${entry.id === activeId ? "active" : ""}" data-entry-id="${entry.id}" type="button">
      <strong>${escapeHtml(entry.title || "未命名感想")}</strong>
      <span>${escapeHtml(formatDate(entry.date, entry.time))}</span>
      <span>${escapeHtml(stripHtml(entry.content)).slice(0, 42)}</span>
      ${entry.tags?.length ? `<div class="tag-row">${entry.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    </button>
  `).join("");
  document.querySelectorAll("[data-entry-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeId = button.dataset.entryId;
      const entry = activeEntry();
      viewDate = new Date(entry.date);
      spreadIndex = 0;
      saveState();
      render();
    });
  });
}

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  el.monthLabel.textContent = `${year}年${month + 1}月`;
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const active = activeEntry();
  const entryDates = new Set(state.entries.map((entry) => entry.date));
  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = prevDays - i;
    cells.push({ day, date: toDateInput(new Date(year, month - 1, day)), muted: true });
  }
  for (let day = 1; day <= days; day++) {
    cells.push({ day, date: toDateInput(new Date(year, month, day)), muted: false });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - firstWeekday - days + 1;
    cells.push({ day, date: toDateInput(new Date(year, month + 1, day)), muted: true });
  }
  el.calendarGrid.innerHTML = cells.map((cell) => `
    <button class="calendar-day ${cell.muted ? "muted" : ""} ${entryDates.has(cell.date) ? "has-entry" : ""} ${active?.date === cell.date ? "active" : ""}" data-date="${cell.date}" type="button">${cell.day}</button>
  `).join("");
  document.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const pickedDate = button.dataset.date;
      const entry = state.entries.find((item) => item.date === pickedDate);
      if (entry) {
        activeId = entry.id;
      } else if (activeEntry()) {
        const current = activeEntry();
        current.date = pickedDate;
        current.updatedAt = new Date().toISOString();
        activeId = current.id;
      }
      viewDate = new Date(`${pickedDate}T00:00`);
      spreadIndex = 0;
      saveState();
      render();
    });
  });
}

function renderDetail(restoreEditor) {
  const entry = activeEntry();
  const hasEntry = Boolean(entry);
  el.emptyState.classList.toggle("hidden", hasEntry);
  el.journalDesk.classList.toggle("hidden", !hasEntry);
  el.editorPanel.classList.toggle("hidden", !hasEntry);
  el.deleteEntryButton.disabled = !hasEntry;
  el.backupButton.disabled = !state.entries.length;
  el.soundToggleButton.textContent = `翻页声音：${soundOn ? "开" : "关"}`;
  el.soundSelect.value = soundKind;
  if (!entry) {
    el.currentEntryTitle.textContent = "还没有记录";
    return;
  }
  el.currentEntryTitle.textContent = entry.title || "未命名感想";
  if (restoreEditor && document.activeElement !== el.editor) {
    el.titleInput.value = entry.title || "";
    el.dateInput.value = entry.date || "";
    el.timeInput.value = entry.time || "";
    el.tagsInput.value = (entry.tags || []).join("、");
    el.backgroundSelect.value = entry.background || "paper";
    el.editor.innerHTML = entry.content || "";
  }
  el.photoBackgroundField.classList.toggle("hidden", el.backgroundSelect.value !== "photo");
  renderBook(entry);
  hydrateEntryAssets(entry);
}


function mediaBlockSelector() {
  return "figure, .media-card, .video-card, .scene-card, img, video";
}

function contentBlockSelector() {
  return "[data-block-id], [data-media-id], figure, .media-card, .video-card, .scene-card, h1, h2, h3, h4, p, blockquote, hr, ul, ol, li, img, video";
}

function ensureEntryMediaIds(entry) {
  if (!entry?.content) return;
  const temp = document.createElement("div");
  temp.innerHTML = entry.content;
  let changed = false;

  [...temp.children].forEach((node) => {
    if (!node.dataset.blockId) {
      node.dataset.blockId = `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      changed = true;
    }
  });

  temp.querySelectorAll("figure, .media-card, .video-card, .scene-card, img, video").forEach((node) => {
    const block = node.closest("figure, .media-card, .video-card, .scene-card") || node;
    if (!block.dataset.mediaId) {
      block.dataset.mediaId = `media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      changed = true;
    }
    if (node !== block && !node.dataset.mediaId) {
      node.dataset.mediaId = block.dataset.mediaId;
      changed = true;
    }
  });
  if (changed) {
    entry.content = temp.innerHTML;
    saveState();
  }
}

function deleteBlockFromEntry(blockId, mediaId) {
  const entry = activeEntry();
  if (!entry || (!blockId && !mediaId)) return false;
  const temp = document.createElement("div");
  temp.innerHTML = entry.content || "";
  const selector = mediaId ? `[data-media-id="${CSS.escape(mediaId)}"]` : `[data-block-id="${CSS.escape(blockId)}"]`;
  const node = temp.querySelector(selector);
  if (!node) return false;
  const block = node.closest("figure, .media-card, .video-card, .scene-card, [data-block-id]") || node;
  const next = block.nextElementSibling;
  block.remove();
  if (next?.tagName === "P" && !next.textContent.trim() && next.innerHTML.includes("<br")) {
    next.remove();
  }
  entry.content = temp.innerHTML;
  entry.updatedAt = new Date().toISOString();
  el.editor.innerHTML = entry.content;
  selectedMediaId = null;
  selectedBlockId = null;
  saveState();
  render();
  el.saveHint.textContent = "已真正删除内容";
  return true;
}

function deleteMediaFromEntry(mediaId) {
  return deleteBlockFromEntry(null, mediaId);
}
function splitContentIntoPages(entry) {
  const temp = document.createElement("div");
  temp.innerHTML = entry.content || "";
  const nodes = [...temp.childNodes].filter((node) => node.textContent?.trim() || node.nodeType === 1);
  const chunks = [];
  let current = "";
  let size = 0;
  nodes.forEach((node) => {
    const html = node.outerHTML || escapeHtml(node.textContent || "");
    const weight = Math.max(80, stripHtml(html).length + html.length * 0.22);
    if (current && size + weight > 1050) {
      chunks.push(current);
      current = "";
      size = 0;
    }
    current += html;
    size += weight;
  });
  if (current) chunks.push(current);
  if (!chunks.length) chunks.push("<p>这一页还没有内容。</p>");
  return chunks.map((chunk, index) => ({
    title: index === 0 ? entry.title : `${entry.title || "感想"} · 续`,
    body: chunk
  }));
}

function renderBook(entry) {
  const pages = splitContentIntoPages(entry);
  const spreadCount = Math.max(1, Math.ceil(pages.length / 2));
  spreadIndex = Math.min(spreadIndex, spreadCount - 1);
  const left = pages[spreadIndex * 2];
  const right = pages[spreadIndex * 2 + 1];
  el.leftPage.className = `paper-page left-page ${backgroundClass(entry)}`;
  el.rightPage.className = `paper-page right-page ${backgroundClass(entry)}`;
  applyPhotoBackground(el.leftPage, entry);
  applyPhotoBackground(el.rightPage, entry);
  el.leftPage.innerHTML = pageHtml(entry, left, spreadIndex * 2 + 1);
  el.rightPage.innerHTML = right ? pageHtml(entry, right, spreadIndex * 2 + 2) : `<span class="page-number">${spreadIndex * 2 + 2}</span>`;
  el.pageLabel.textContent = `${spreadIndex + 1} / ${spreadCount}`;
  el.prevPageButton.disabled = spreadIndex === 0;
  el.nextPageButton.disabled = spreadIndex >= spreadCount - 1;
}

function backgroundClass(entry) {
  return `page-bg-${entry.background || "paper"}`;
}

function applyPhotoBackground(node, entry) {
  if (entry.background === "photo" && entry.backgroundImage) {
    node.style.backgroundImage = `linear-gradient(rgba(255,248,232,.72), rgba(255,248,232,.72)), url(${entry.backgroundImage})`;
  } else {
    node.style.backgroundImage = "";
  }
}

function pageHtml(entry, page, number) {
  return `
    <div class="page-date">${escapeHtml(formatDate(entry.date, entry.time))}</div>
    <h1 class="page-title">${escapeHtml(page.title || "未命名感想")}</h1>
    <div class="page-content">${page.body}</div>
    <span class="page-number">${number}</span>
  `;
}

function turn(direction) {
  const entry = activeEntry();
  if (!entry) return;
  const max = Math.max(1, Math.ceil(splitContentIntoPages(entry).length / 2)) - 1;
  const next = direction === "next" ? Math.min(max, spreadIndex + 1) : Math.max(0, spreadIndex - 1);
  if (next === spreadIndex) return;
  el.turnPage.className = `turn-page ${backgroundClass(entry)}`;
  applyPhotoBackground(el.turnPage, entry);
  el.turnPage.innerHTML = direction === "next" ? el.rightPage.innerHTML : el.leftPage.innerHTML;
  el.bookStage.classList.remove("flipping-next", "flipping-prev");
  void el.bookStage.offsetWidth;
  el.bookStage.classList.add(direction === "next" ? "flipping-next" : "flipping-prev");
  playPageSound();
  window.setTimeout(() => {
    spreadIndex = next;
    el.bookStage.classList.remove("flipping-next", "flipping-prev");
    renderBook(entry);
  }, 520);
}

function playPageSound() {
  if (!soundOn) return;
  const audio = new Audio();
  const tones = {
    soft: [220, 0.035, 0.12],
    deep: [130, 0.05, 0.16],
    crisp: [360, 0.025, 0.08]
  };
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const [freq, attack, duration] = tones[soundKind] || tones.soft;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    audio.volume = 0;
  }
}

function saveSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  if (el.editor.contains(selection.anchorNode)) lastRange = selection.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  if (!lastRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(lastRange);
}

function insertHtmlAtCursor(html) {
  el.editor.focus();
  restoreSelection();
  document.execCommand("insertHTML", false, html);
  lastRange = null;
  updateActive({ content: el.editor.innerHTML });
}


function openAssetDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("assets", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAsset(file) {
  const db = await openAssetDb();
  const id = `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put({ id, name: file.name, type: file.type, blob: file });
    tx.oncomplete = () => resolve({ id, name: file.name, type: file.type, url: URL.createObjectURL(file) });
    tx.onerror = () => reject(tx.error);
  });
}

async function getAssetUrl(id) {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readonly");
    const request = tx.objectStore("assets").get(id);
    request.onsuccess = () => {
      const asset = request.result;
      resolve(asset?.blob ? URL.createObjectURL(asset.blob) : "");
    };
    request.onerror = () => reject(request.error);
  });
}

async function hydrateEntryAssets(entry) {
  if (!entry?.content || !entry.content.includes("data-asset-id")) return;
  const temp = document.createElement("div");
  temp.innerHTML = entry.content;
  const nodes = [...temp.querySelectorAll("[data-asset-id]")];
  let changed = false;
  for (const node of nodes) {
    const url = await getAssetUrl(node.dataset.assetId).catch(() => "");
    if (url && node.getAttribute("src") !== url) {
      node.setAttribute("src", url);
      changed = true;
    }
  }
  if (changed) {
    entry.content = temp.innerHTML;
    saveState();
    render(false);
  }
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function insertImage(file) {
  if (!file) return;
  const src = await fileToDataUrl(file);
  const mediaId = uid().replace("entry", "media");
  insertHtmlAtCursor(`<figure contenteditable="false" data-media-id="${mediaId}"><img data-media-id="${mediaId}" src="${src}" alt="${escapeHtml(file.name)}" style="width: 72%;"><figcaption contenteditable="true">${escapeHtml(file.name)}</figcaption></figure><p><br></p>`);
}

async function insertAudio(file) {
  if (!file) return;
  const src = await fileToDataUrl(file);
  const mediaId = uid().replace("entry", "media");
  insertHtmlAtCursor(`<div class="media-card" contenteditable="false" data-media-id="${mediaId}"><strong>♪ ${escapeHtml(file.name)}</strong><audio controls src="${src}"></audio></div><p><br></p>`);
}

async function insertVideo(file) {
  if (!file) return;
  el.saveHint.textContent = "正在插入视频...";
  try {
    const asset = await saveAsset(file);
    const mediaId = uid().replace("entry", "media");
    insertHtmlAtCursor(`<div class="video-card selected-media" contenteditable="false" data-media-id="${mediaId}"><strong>${escapeHtml(asset.name)}</strong><video controls loop data-media-id="${mediaId}" data-asset-id="${asset.id}" src="${asset.url}"></video></div><p><br></p>`);
    selectedMediaId = mediaId;
    el.saveHint.textContent = "视频已插入";
  } catch (error) {
    console.warn("视频插入失败", error);
    el.saveHint.textContent = "视频插入失败，文件可能太大";
  }
}

function insertScene(kind) {
  const names = { rain: "下雨", snow: "飘雪", leaves: "落叶", stars: "星空", candle: "烛光" };
  const mediaId = uid().replace("entry", "media");
  insertHtmlAtCursor(`<div class="scene-card ${kind}" contenteditable="false" data-media-id="${mediaId}"><span>${names[kind] || "动态场景"}</span></div><p><br></p>`);
  selectedMediaId = mediaId;
  el.sceneDialog.close();
}


function mediaSelector() {
  return contentBlockSelector();
}

function clearSelectedMedia() {
  el.editor.querySelectorAll(".selected-media").forEach((node) => node.classList.remove("selected-media"));
  el.leftPage.querySelectorAll(".selected-media").forEach((node) => node.classList.remove("selected-media"));
  el.rightPage.querySelectorAll(".selected-media").forEach((node) => node.classList.remove("selected-media"));
}

function selectMediaNode(node) {
  const target = node.closest("figure, .media-card, .video-card, .scene-card, [data-block-id], h1, h2, h3, h4, p, blockquote, hr, ul, ol, li") || node;
  clearSelectedMedia();
  target.classList.add("selected-media");
  selectedMediaId = target.dataset.mediaId || node.dataset.mediaId || null;
  selectedBlockId = target.dataset.blockId || node.dataset.blockId || null;
  el.saveHint.textContent = (selectedMediaId || selectedBlockId) ? "已选中，可删除" : "这个内容没有编号，请点一次预览后再试";
}

function deleteSelectedMedia() {
  const selected = el.editor.querySelector(".selected-media") || el.leftPage.querySelector(".selected-media") || el.rightPage.querySelector(".selected-media");
  const mediaId = selected?.dataset.mediaId || selectedMediaId;
  const blockId = selected?.dataset.blockId || selectedBlockId;
  if ((mediaId || blockId) && deleteBlockFromEntry(blockId, mediaId)) return;
  if (selected && el.editor.contains(selected)) {
    selected.remove();
    updateActive({ content: el.editor.innerHTML });
    selectedMediaId = null;
    selectedBlockId = null;
    el.saveHint.textContent = "已删除选中内容";
    return;
  }
  el.saveHint.textContent = "先右键标题、段落、横线、图片或视频";
}

function ensureContextMenu() {
  if (el.contextMenu) return el.contextMenu;
  const menu = document.createElement("div");
  menu.className = "context-menu hidden";
  menu.innerHTML = `<button type="button" data-action="delete-media">删除这个内容</button>`;
  document.body.appendChild(menu);
  menu.addEventListener("click", (event) => {
    if (event.target?.dataset.action === "delete-media") {
      deleteSelectedMedia();
      hideContextMenu();
    }
  });
  el.contextMenu = menu;
  return menu;
}

function showContextMenu(x, y) {
  const menu = ensureContextMenu();
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove("hidden");
}

function hideContextMenu() {
  el.contextMenu?.classList.add("hidden");
}

function handleMediaContextMenu(event) {
  const media = event.target.closest(mediaSelector());
  if (!media) return;
  event.preventDefault();
  selectMediaNode(media);
  showContextMenu(event.clientX, event.clientY);
}
function backupData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "拟态感想日记本-备份.json";
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  el.newEntryButton.addEventListener("click", createEntry);
  el.emptyNewButton.addEventListener("click", createEntry);
  el.searchInput.addEventListener("input", renderList);
  el.prevMonthButton.addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderCalendar(); });
  el.nextMonthButton.addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderCalendar(); });
  el.prevPageButton.addEventListener("click", () => turn("prev"));
  el.nextPageButton.addEventListener("click", () => turn("next"));
  el.leftPage.addEventListener("click", (event) => { if (event.offsetX < 80) turn("prev"); });
  el.rightPage.addEventListener("click", (event) => { if (event.offsetX > el.rightPage.clientWidth - 80) turn("next"); });
  el.soundToggleButton.addEventListener("click", () => { soundOn = !soundOn; saveState(); render(false); });
  el.soundSelect.addEventListener("change", () => { soundKind = el.soundSelect.value; saveState(); render(false); });
  el.backupButton.addEventListener("click", backupData);
  el.deleteEntryButton.addEventListener("click", deleteActive);

  el.titleInput.addEventListener("input", () => updateActive({ title: el.titleInput.value }));
  el.dateInput.addEventListener("change", () => { updateActive({ date: el.dateInput.value }); viewDate = new Date(el.dateInput.value); render(); });
  el.timeInput.addEventListener("change", () => updateActive({ time: el.timeInput.value }));
  el.tagsInput.addEventListener("input", () => updateActive({ tags: el.tagsInput.value.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean) }));
  el.backgroundSelect.addEventListener("change", () => updateActive({ background: el.backgroundSelect.value }));
  el.backgroundImageInput.addEventListener("change", async () => {
    const file = el.backgroundImageInput.files?.[0];
    if (!file) return;
    updateActive({ backgroundImage: await fileToDataUrl(file), background: "photo" });
  });
  el.editor.addEventListener("keyup", saveSelection);
  el.editor.addEventListener("mouseup", saveSelection);
  el.editor.addEventListener("input", () => updateActive({ content: el.editor.innerHTML }));
  document.querySelectorAll(".format-bar button").forEach((button) => {
    button.addEventListener("click", () => {
      el.editor.focus();
      document.execCommand(button.dataset.command, false, button.dataset.value || null);
      updateActive({ content: el.editor.innerHTML });
    });
  });
  el.imageInput.addEventListener("change", () => insertImage(el.imageInput.files?.[0]));
  el.audioInput.addEventListener("change", () => insertAudio(el.audioInput.files?.[0]));
  el.videoInput.addEventListener("change", () => insertVideo(el.videoInput.files?.[0]));
  el.deleteSelectedButton.addEventListener("click", deleteSelectedMedia);
  el.editor.addEventListener("contextmenu", handleMediaContextMenu);
  el.leftPage.addEventListener("contextmenu", handleMediaContextMenu);
  el.rightPage.addEventListener("contextmenu", handleMediaContextMenu);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".context-menu")) hideContextMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideContextMenu();
  });
  el.editor.addEventListener("click", (event) => {
    const media = event.target.closest(mediaSelector());
    if (media) selectMediaNode(media);
  });
  el.editor.addEventListener("keydown", (event) => {
    if ((event.key === "Delete" || event.key === "Backspace") && el.editor.querySelector(".selected-media")) {
      event.preventDefault();
      deleteSelectedMedia();
    }
  });
  el.insertSceneButton.addEventListener("click", () => { saveSelection(); el.sceneDialog.showModal(); });
  document.querySelectorAll(".scene-options button").forEach((button) => {
    button.addEventListener("click", () => insertScene(button.value));
  });
}

bindEvents();
render();




