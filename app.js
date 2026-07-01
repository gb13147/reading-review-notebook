const STORAGE_KEY = "morphic-media-diary-v1";

const state = loadState();
let activeId = state.activeId || state.entries[0]?.id || null;
let viewDate = activeEntry()?.date ? new Date(activeEntry().date) : new Date();
let spreadIndex = 0;
let soundOn = state.settings.soundOn ?? true;
let soundKind = state.settings.soundKind || "soft";
let lastRange = null;

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
  sceneDialog: document.querySelector("#sceneDialog"),
  saveHint: document.querySelector("#saveHint")
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  el.saveHint.textContent = "已自动保存";
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
      const entry = state.entries.find((item) => item.date === button.dataset.date);
      if (entry) {
        activeId = entry.id;
        spreadIndex = 0;
      } else {
        viewDate = new Date(`${button.dataset.date}T00:00`);
      }
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
  insertHtmlAtCursor(`<figure contenteditable="false"><img src="${src}" alt="${escapeHtml(file.name)}" style="width: 72%;"><figcaption contenteditable="true">${escapeHtml(file.name)}</figcaption></figure><p><br></p>`);
}

async function insertAudio(file) {
  if (!file) return;
  const src = await fileToDataUrl(file);
  insertHtmlAtCursor(`<div class="media-card" contenteditable="false"><strong>♪ ${escapeHtml(file.name)}</strong><audio controls src="${src}"></audio></div><p><br></p>`);
}

async function insertVideo(file) {
  if (!file) return;
  const src = await fileToDataUrl(file);
  insertHtmlAtCursor(`<video controls loop src="${src}" style="width: 80%;"></video><p><br></p>`);
}

function insertScene(kind) {
  const names = { rain: "下雨", snow: "飘雪", leaves: "落叶", stars: "星空", candle: "烛光" };
  insertHtmlAtCursor(`<div class="scene-card ${kind}" contenteditable="false"><span>${names[kind] || "动态场景"}</span></div><p><br></p>`);
  el.sceneDialog.close();
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
  el.insertSceneButton.addEventListener("click", () => { saveSelection(); el.sceneDialog.showModal(); });
  document.querySelectorAll(".scene-options button").forEach((button) => {
    button.addEventListener("click", () => insertScene(button.value));
  });
}

bindEvents();
render();
