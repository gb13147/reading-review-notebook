const STORAGE_KEY = "reading-notebook-v2";
const OLD_STORAGE_KEY = "reading-notebook-v1";

const sampleBooks = [
  {
    id: "sample-1",
    title: "活着",
    author: "余华",
    publisher: "作家出版社",
    isbn: "9787506365437",
    description: "一部关于命运、苦难与生命韧性的小说。",
    cover: "https://covers.openlibrary.org/b/isbn/9787506365437-L.jpg",
    status: "在读",
    rating: 8.5,
    recommend: "强烈推荐",
    review: "这本书适合慢慢读。它没有用激烈的语言煽动情绪，而是把人物的一生放在读者面前，让人自己感受到命运的重量。",
    quotes: [
      {
        id: "q-1",
        page: "12",
        text: "人是为了活着本身而活着，而不是为了活着之外的任何事物所活着。",
        note: "这句话可以作为整本书的精神入口。",
        keywords: ["生命", "主题"],
        createdAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString()
  }
];

let state = loadState();
let activeBookId = state.activeBookId || state.books[0]?.id || null;
let serverStorageEnabled = location.protocol !== "file:";
let pendingSaveTimer = null;
let statusFilter = "all";
let editingQuoteId = null;
let flipSpread = 0;
let searchTimer = null;
let latestSearchTerm = "";

const el = {
  newBookButton: document.querySelector("#newBookButton"),
  emptyAddButton: document.querySelector("#emptyAddButton"),
  librarySearch: document.querySelector("#librarySearch"),
  libraryList: document.querySelector("#libraryList"),
  currentTitle: document.querySelector("#currentTitle"),
  emptyState: document.querySelector("#emptyState"),
  bookDetail: document.querySelector("#bookDetail"),
  coverImage: document.querySelector("#coverImage"),
  coverFallback: document.querySelector("#coverFallback"),
  titleInput: document.querySelector("#titleInput"),
  metaLine: document.querySelector("#metaLine"),
  statusInput: document.querySelector("#statusInput"),
  ratingInput: document.querySelector("#ratingInput"),
  ratingValue: document.querySelector("#ratingValue"),
  recommendInput: document.querySelector("#recommendInput"),
  longReviewInput: document.querySelector("#longReviewInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  quoteSearch: document.querySelector("#quoteSearch"),
  quoteCounter: document.querySelector("#quoteCounter"),
  quoteList: document.querySelector("#quoteList"),
  addQuoteButton: document.querySelector("#addQuoteButton"),
  bookDialog: document.querySelector("#bookDialog"),
  bookSearchInput: document.querySelector("#bookSearchInput"),
  searchBookButton: document.querySelector("#searchBookButton"),
  searchResults: document.querySelector("#searchResults"),
  manualTitle: document.querySelector("#manualTitle"),
  manualAuthor: document.querySelector("#manualAuthor"),
  manualPublisher: document.querySelector("#manualPublisher"),
  manualAddButton: document.querySelector("#manualAddButton"),
  quoteDialog: document.querySelector("#quoteDialog"),
  quoteDialogTitle: document.querySelector("#quoteDialogTitle"),
  quotePageInput: document.querySelector("#quotePageInput"),
  quoteTextInput: document.querySelector("#quoteTextInput"),
  quoteNoteInput: document.querySelector("#quoteNoteInput"),
  quoteTagsInput: document.querySelector("#quoteTagsInput"),
  saveQuoteButton: document.querySelector("#saveQuoteButton"),
  deleteQuoteButton: document.querySelector("#deleteQuoteButton"),
  exportMarkdownButton: document.querySelector("#exportMarkdownButton"),
  exportJsonButton: document.querySelector("#exportJsonButton")
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) return { books: sampleBooks, activeBookId: sampleBooks[0].id };
  try {
    const parsed = JSON.parse(raw);
    return {
      books: (parsed.books || []).map(normalizeBook),
      activeBookId: parsed.activeBookId || null
    };
  } catch {
    return { books: sampleBooks, activeBookId: sampleBooks[0].id };
  }
}

function normalizeBook(book) {
  return {
    id: book.id || uid("book"),
    title: book.title || "未命名书籍",
    author: book.author || "",
    publisher: book.publisher || "",
    isbn: book.isbn || "",
    description: book.description || "",
    cover: book.cover || "",
    status: book.status || "想读",
    rating: Number(book.rating || 0),
    recommend: book.recommend || "一般",
    review: book.review || book.longReview || book.shortReview || "",
    quotes: (book.quotes || []).map((quote) => ({
      id: quote.id || uid("q"),
      page: quote.page || quote.page_no || "",
      text: quote.text || quote.quote_text || "",
      note: quote.note || quote.my_note || "",
      keywords: quote.keywords || quote.tags || [],
      createdAt: quote.createdAt || new Date().toISOString()
    })),
    createdAt: book.createdAt || new Date().toISOString()
  };
}

function saveState() {
  state.activeBookId = activeBookId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (serverStorageEnabled) {
    clearTimeout(pendingSaveTimer);
    pendingSaveTimer = setTimeout(saveStateToServer, 250);
  }
}

async function saveStateToServer() {
  try {
    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
    serverStorageEnabled = response.ok;
  } catch {
    serverStorageEnabled = false;
  }
}

async function loadStateFromServer() {
  if (!serverStorageEnabled) return;
  try {
    const response = await fetch("/api/data");
    if (!response.ok) return;
    const serverState = await response.json();
    if (Array.isArray(serverState.books) && serverState.books.length) {
      state = {
        books: serverState.books.map(normalizeBook),
        activeBookId: serverState.activeBookId || serverState.books[0]?.id || null
      };
      activeBookId = state.activeBookId || state.books[0]?.id || null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    } else if (state.books.length) {
      await saveStateToServer();
    }
  } catch {
    serverStorageEnabled = false;
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeBook() {
  return state.books.find((book) => book.id === activeBookId) || null;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compactText(value, fallback = "未填写") {
  const text = String(value || "").trim();
  return text || fallback;
}

function updateBook(patch, shouldRender = false) {
  const book = activeBook();
  if (!book) return;
  Object.assign(book, patch);
  saveState();
  if (patch.title !== undefined) el.currentTitle.textContent = patch.title || "未命名书籍";
  if (patch.rating !== undefined) el.ratingValue.textContent = `${patch.rating || 0} / 10`;
  if (shouldRender) render();
  else renderFlipbook(book);
}

function render() {
  renderLibrary();
  renderDetail();
}

function renderLibrary() {
  const keyword = el.librarySearch.value.trim().toLowerCase();
  const books = state.books.filter((book) => {
    const inStatus = statusFilter === "all" || book.status === statusFilter;
    const text = [
      book.title,
      book.author,
      book.publisher,
      ...(book.quotes || []).flatMap((quote) => quote.keywords || [])
    ].join(" ").toLowerCase();
    return inStatus && (!keyword || text.includes(keyword));
  });

  if (!books.length) {
    el.libraryList.innerHTML = `<div class="empty-mini">没有匹配的书籍</div>`;
    return;
  }

  el.libraryList.innerHTML = books
    .map((book) => `
      <button class="book-item ${book.id === activeBookId ? "active" : ""}" type="button" data-book-id="${book.id}">
        ${book.cover ? `<img class="book-thumb" src="${escapeHtml(book.cover)}" alt="">` : `<div class="book-thumb"></div>`}
        <span>
          <h3>${escapeHtml(book.title)}</h3>
          <p>${escapeHtml([book.author, `${book.quotes?.length || 0} 条摘抄`].filter(Boolean).join(" · "))}</p>
        </span>
        <span class="badge">${escapeHtml(book.status || "想读")}</span>
      </button>
    `)
    .join("");

  document.querySelectorAll("[data-book-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeBookId = button.dataset.bookId;
      flipSpread = 0;
      saveState();
      render();
    });
  });
}

function renderDetail() {
  const book = activeBook();
  const hasBook = Boolean(book);
  el.emptyState.classList.toggle("hidden", hasBook);
  el.bookDetail.classList.toggle("hidden", !hasBook);
  el.exportMarkdownButton.disabled = !hasBook;
  el.exportJsonButton.disabled = !state.books.length;
  if (!book) {
    el.currentTitle.textContent = "还没有选择书籍";
    return;
  }

  el.currentTitle.textContent = book.title || "未命名书籍";
  el.coverImage.src = book.cover || "";
  el.coverImage.classList.toggle("hidden", !book.cover);
  el.coverFallback.classList.toggle("hidden", Boolean(book.cover));
  el.titleInput.value = book.title || "";
  const meta = [book.author, book.publisher].filter(Boolean).join(" · ");
  el.metaLine.textContent = meta;
  el.metaLine.classList.toggle("hidden", !meta);
  el.statusInput.value = book.status || "想读";
  el.ratingInput.value = book.rating || 0;
  el.ratingValue.textContent = `${book.rating || 0} / 10`;
  el.recommendInput.value = book.recommend || "一般";
  el.longReviewInput.value = book.review || "";
  el.descriptionInput.value = book.description || "";

  renderQuotes(book);
  ensureFlipbookPanel();
  renderFlipbook(book);
}

function renderQuotes(book) {
  const keyword = el.quoteSearch.value.trim().toLowerCase();
  let quotes = book.quotes || [];
  if (keyword) {
    quotes = quotes.filter((quote) =>
      [quote.text, quote.note, quote.page, ...(quote.keywords || [])].join(" ").toLowerCase().includes(keyword)
    );
  }

  el.quoteCounter.textContent = `${quotes.length} 条`;
  if (!quotes.length) {
    el.quoteList.innerHTML = `<div class="empty-mini">这里还没有摘抄</div>`;
    return;
  }

  el.quoteList.innerHTML = quotes
    .map((quote) => {
      const quoteIndex = (book.quotes || []).findIndex((item) => item.id === quote.id) + 1;
      const tags = (quote.keywords || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
      return `
        <article class="quote-card numbered-quote" data-quote-id="${quote.id}">
          <div class="quote-number">${quoteIndex}</div>
          <div>
            <blockquote>${escapeHtml(quote.text)}</blockquote>
            ${quote.note ? `<p>${escapeHtml(quote.note)}</p>` : ""}
            ${tags ? `<div class="tag-row">${tags}</div>` : ""}
            <footer>
              <span>${quote.page ? `p.${escapeHtml(quote.page)}` : ""}</span>
              <button class="ghost" type="button" data-edit-quote="${quote.id}">编辑</button>
            </footer>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-edit-quote]").forEach((button) => {
    button.addEventListener("click", () => openQuoteDialog(button.dataset.editQuote));
  });
}

function ensureFlipbookPanel() {
  if (document.querySelector("#flipbookPanel")) return;
  const panel = document.createElement("section");
  panel.id = "flipbookPanel";
  panel.className = "flipbook-panel";
  panel.innerHTML = `
    <div class="flipbook-head">
      <div>
        <h3>翻书预览</h3>
        <div id="flipToc" class="flip-toc"></div>
      </div>
      <div class="flip-controls">
        <button id="prevSpreadButton" class="ghost" type="button">上一页</button>
        <span id="spreadLabel" class="badge">1 / 1</span>
        <button id="nextSpreadButton" class="ghost" type="button">下一页</button>
      </div>
    </div>
    <div class="book-view">
      <article id="leftPage" class="book-page left"></article>
      <article id="rightPage" class="book-page right"></article>
    </div>
  `;
  el.bookDetail.appendChild(panel);
  document.querySelector("#prevSpreadButton").addEventListener("click", () => {
    flipSpread = Math.max(0, flipSpread - 1);
    renderFlipbook(activeBook());
  });
  document.querySelector("#nextSpreadButton").addEventListener("click", () => {
    const spreads = Math.ceil(buildPages(activeBook()).length / 2);
    flipSpread = Math.min(spreads - 1, flipSpread + 1);
    renderFlipbook(activeBook());
  });
}

function buildPages(book) {
  if (!book) return [];
  const pages = [
    {
      kind: "cover",
      html: `
        <h3>${escapeHtml(book.title || "未命名书籍")}</h3>
        ${book.author ? `<p>${escapeHtml(book.author)}</p>` : ""}
        <p>${escapeHtml(book.description || "暂无简介。")}</p>
      `
    },
    {
      kind: "review",
      html: `
        <h3>我的评价</h3>
        <p><strong>评分：</strong>${escapeHtml(book.rating || 0)} / 10</p>
        <p><strong>推荐：</strong>${escapeHtml(book.recommend || "一般")}</p>
        <p>${escapeHtml(book.review || "还没有写评价。")}</p>
      `
    }
  ];

  const quotes = book.quotes || [];
  quotes.forEach((quote, index) => {
    pages.push({
      kind: "quote",
      quoteIndex: index + 1,
      html: `
        <h3>摘抄 ${index + 1}</h3>
        <div class="page-quote">
          <strong>${index + 1}.</strong>
          <blockquote>${escapeHtml(quote.text)}</blockquote>
          ${quote.note ? `<small>${escapeHtml(quote.note)}</small>` : ""}
          ${(quote.page || quote.keywords?.length) ? `<small>${quote.page ? `p.${escapeHtml(quote.page)}${quote.keywords?.length ? " · " : ""}` : ""}${escapeHtml((quote.keywords || []).join("、"))}</small>` : ""}
        </div>
      `
    });
  });
  return pages;
}

function renderFlipbook(book) {
  if (!book || !document.querySelector("#leftPage")) return;
  const pages = buildPages(book);
  const spreads = Math.max(1, Math.ceil(pages.length / 2));
  flipSpread = Math.min(flipSpread, spreads - 1);
  const leftIndex = flipSpread * 2;
  const rightIndex = leftIndex + 1;
  document.querySelector("#leftPage").innerHTML = renderPage(pages[leftIndex], leftIndex);
  document.querySelector("#rightPage").innerHTML = renderPage(pages[rightIndex], rightIndex);
  document.querySelector("#spreadLabel").textContent = `${flipSpread + 1} / ${spreads}`;
  document.querySelector("#prevSpreadButton").disabled = flipSpread === 0;
  document.querySelector("#nextSpreadButton").disabled = flipSpread >= spreads - 1;
  renderFlipToc(book, pages);
}

function renderFlipToc(book, pages) {
  const toc = document.querySelector("#flipToc");
  if (!toc) return;
  const quotes = book.quotes || [];
  if (!quotes.length) {
    toc.innerHTML = `<span class="meta-line">还没有摘抄</span>`;
    return;
  }
  toc.innerHTML = quotes
    .map((_, index) => `<button class="toc-number" type="button" data-jump-quote="${index + 1}">${index + 1}</button>`)
    .join("");
  document.querySelectorAll("[data-jump-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      const quoteIndex = Number(button.dataset.jumpQuote);
      const pageIndex = pages.findIndex((page) => page.quoteIndex === quoteIndex);
      if (pageIndex >= 0) {
        flipSpread = Math.floor(pageIndex / 2);
        renderFlipbook(activeBook());
        document.querySelector("#flipbookPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function renderPage(page, index) {
  if (!page) return `<p></p>`;
  return `${page.html}<span class="page-number">${index + 1}</span>`;
}

function addBook(book) {
  state.books.unshift(normalizeBook({
    id: uid("book"),
    title: book.title || "未命名书籍",
    author: book.author || "",
    publisher: book.publisher || "",
    isbn: book.isbn || "",
    description: book.description || "",
    cover: book.cover || "",
    status: "想读",
    rating: 0,
    recommend: "一般",
    review: "",
    quotes: [],
    createdAt: new Date().toISOString()
  }));
  activeBookId = state.books[0].id;
  flipSpread = 0;
  saveState();
  el.bookDialog.close();
  render();
}

async function searchBooks() {
  const keyword = el.bookSearchInput.value.trim();
  latestSearchTerm = keyword;
  if (!keyword) {
    el.searchResults.innerHTML = `<p class="meta-line">输入书名后会自动搜索候选书籍和封面。</p>`;
    return;
  }
  el.searchResults.innerHTML = `<p class="meta-line">正在搜索...</p>`;
  try {
    const results = await fetchBookCandidates(keyword);
    if (keyword !== latestSearchTerm) return;
    renderSearchResults(results);
  } catch {
    const fileTip = location.protocol === "file:" ? "当前是直接打开文件，联网搜索容易失败。请双击 start_reading_notebook.bat 后再搜索。" : "";
    el.searchResults.innerHTML = `<p class="meta-line">联网搜索暂时不可用。${fileTip} 也可以先手动添加，之后再补书名和封面。</p>`;
  }
}

async function fetchBookCandidates(keyword) {
  if (location.protocol !== "file:") {
    const localResponse = await fetch(`/api/search-books?q=${encodeURIComponent(keyword)}`);
    if (localResponse.ok) {
      const localResults = await localResponse.json();
      if (Array.isArray(localResults) && localResults.length) return localResults;
    }
  }

  const [googleResults, openLibraryResults, webNovelResults] = await Promise.all([
    searchGoogleBooks(keyword).catch(() => []),
    searchOpenLibrary(keyword).catch(() => []),
    searchWebNovel(keyword).catch(() => [])
  ]);
  return uniqueBooks([...googleResults, ...openLibraryResults, ...webNovelResults]).slice(0, 12);
}

async function searchGoogleBooks(keyword) {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}&maxResults=10`);
  const data = await response.json();
  return (data.items || []).map((item) => {
    const info = item.volumeInfo || {};
    const isbn = (info.industryIdentifiers || []).find((id) => id.type.includes("ISBN"))?.identifier || "";
    return {
      title: info.title || keyword,
      author: (info.authors || []).join("、"),
      publisher: info.publisher || "",
      isbn,
      description: info.description || "",
      cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "")
    };
  });
}

async function searchOpenLibrary(keyword) {
  const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=10`);
  const data = await response.json();
  return (data.docs || []).map((item) => {
    const isbn = item.isbn?.[0] || "";
    return {
      title: item.title || keyword,
      author: (item.author_name || []).join("、"),
      publisher: item.publisher?.[0] || "",
      isbn,
      description: item.first_sentence?.[0] || "",
      cover: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : ""
    };
  });
}

async function searchWebNovel(keyword) {
  const response = await fetch(`https://api.zhuishushenqi.com/book/fuzzy-search?query=${encodeURIComponent(keyword)}`);
  const data = await response.json();
  return (data.books || []).map((item) => ({
    title: item.title || keyword,
    author: item.author || "",
    publisher: item.majorCate || item.minorCate || "网络小说",
    isbn: "",
    description: item.shortIntro || "",
    cover: item.cover ? `https://statics.zhuishushenqi.com${item.cover}` : ""
  }));
}

function uniqueBooks(books) {
  const seen = new Set();
  return books.filter((book) => {
    const key = `${book.title}|${book.author}|${book.isbn}`.toLowerCase();
    if (!book.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scheduleBookSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchBooks, 450);
}

function renderSearchResults(results) {
  if (!results.length) {
    const fileTip = location.protocol === "file:" ? "建议双击 start_reading_notebook.bat 用本地服务打开，搜索会更稳定。" : "";
    el.searchResults.innerHTML = `<p class="meta-line">没有找到候选书籍。${fileTip} 如果是中文网文，公开书籍接口可能没有收录，可以手动添加。</p>`;
    return;
  }
  el.searchResults.innerHTML = results
    .map((book, index) => `
      <article class="result-card">
        ${book.cover ? `<img src="${escapeHtml(book.cover)}" alt="">` : `<div class="book-thumb"></div>`}
        <div>
          <h3>${escapeHtml(book.title)}</h3>
          <p>${escapeHtml([book.author, book.publisher].filter(Boolean).join(" · "))}</p>
        </div>
        <button class="primary-action small" type="button" data-pick-result="${index}">选择</button>
      </article>
    `)
    .join("");
  document.querySelectorAll("[data-pick-result]").forEach((button) => {
    button.addEventListener("click", () => addBook(results[Number(button.dataset.pickResult)]));
  });
}

function openQuoteDialog(quoteId = null) {
  const book = activeBook();
  if (!book) return;
  editingQuoteId = quoteId;
  const quote = (book.quotes || []).find((item) => item.id === quoteId);
  el.quoteDialogTitle.textContent = quote ? "编辑摘抄" : "添加摘抄";
  el.quotePageInput.value = quote?.page || "";
  el.quoteTextInput.value = quote?.text || "";
  el.quoteNoteInput.value = quote?.note || "";
  el.quoteTagsInput.value = quote?.keywords?.join(", ") || "";
  el.deleteQuoteButton.classList.toggle("hidden", !quote);
  el.quoteDialog.showModal();
}

function saveQuote() {
  const book = activeBook();
  if (!book) return;
  const text = el.quoteTextInput.value.trim();
  if (!text) return;
  const payload = {
    page: el.quotePageInput.value.trim(),
    text,
    note: el.quoteNoteInput.value.trim(),
    keywords: el.quoteTagsInput.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
  };
  book.quotes = book.quotes || [];
  if (editingQuoteId) {
    const quote = book.quotes.find((item) => item.id === editingQuoteId);
    Object.assign(quote, payload);
  } else {
    book.quotes.push({ id: uid("q"), ...payload, createdAt: new Date().toISOString() });
  }
  saveState();
  el.quoteDialog.close();
  render();
}

function deleteQuote() {
  const book = activeBook();
  if (!book || !editingQuoteId) return;
  book.quotes = (book.quotes || []).filter((quote) => quote.id !== editingQuoteId);
  editingQuoteId = null;
  saveState();
  el.quoteDialog.close();
  render();
}

function exportMarkdown() {
  const book = activeBook();
  if (!book) return;
  const lines = [
    `# ${book.title}`,
    "",
    `作者：${book.author || ""}`,
    `出版社：${book.publisher || ""}`,
    `状态：${book.status || ""}`,
    `评分：${book.rating || 0} / 10`,
    `推荐：${book.recommend || ""}`,
    "",
    "## 我的评价",
    book.review || "",
    "",
    "## 摘抄",
    ...(book.quotes || []).flatMap((quote, index) => [
      "",
      `${index + 1}. ${quote.text}`,
      quote.page ? `页码：${quote.page}` : "",
      quote.note ? `想法：${quote.note}` : "",
      quote.keywords?.length ? `关键词：${quote.keywords.join("、")}` : ""
    ])
  ];
  downloadText(`${book.title || "读书笔记"}.md`, lines.filter((line) => line !== "").join("\n"));
}

function exportJson() {
  downloadText("reading-notebook-backup.json", JSON.stringify(state, null, 2));
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  el.newBookButton.addEventListener("click", () => {
    el.searchResults.innerHTML = `<p class="meta-line">输入书名后会自动搜索候选书籍和封面。</p>`;
    el.bookDialog.showModal();
  });
  el.emptyAddButton.addEventListener("click", () => el.newBookButton.click());
  el.librarySearch.addEventListener("input", renderLibrary);
  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      statusFilter = button.dataset.status;
      document.querySelectorAll("[data-status]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderLibrary();
    });
  });
  el.searchBookButton.addEventListener("click", searchBooks);
  el.bookSearchInput.addEventListener("input", scheduleBookSearch);
  el.bookSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchBooks();
    }
  });
  el.manualAddButton.addEventListener("click", () => addBook({
    title: el.manualTitle.value.trim(),
    author: el.manualAuthor.value.trim(),
    publisher: el.manualPublisher.value.trim()
  }));
  el.addQuoteButton.addEventListener("click", () => openQuoteDialog());
  el.saveQuoteButton.addEventListener("click", saveQuote);
  el.deleteQuoteButton.addEventListener("click", deleteQuote);
  el.quoteSearch.addEventListener("input", () => renderQuotes(activeBook()));
  el.exportMarkdownButton.addEventListener("click", exportMarkdown);
  el.exportJsonButton.addEventListener("click", exportJson);

  [
    ["input", el.titleInput, () => updateBook({ title: el.titleInput.value })],
    ["change", el.statusInput, () => updateBook({ status: el.statusInput.value }, true)],
    ["input", el.ratingInput, () => updateBook({ rating: Number(el.ratingInput.value) })],
    ["change", el.recommendInput, () => updateBook({ recommend: el.recommendInput.value })],
    ["input", el.longReviewInput, () => updateBook({ review: el.longReviewInput.value })],
    ["input", el.descriptionInput, () => updateBook({ description: el.descriptionInput.value })]
  ].forEach(([eventName, node, handler]) => node.addEventListener(eventName, handler));
}

bindEvents();
render();
loadStateFromServer();
