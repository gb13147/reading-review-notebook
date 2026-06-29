const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || "0.0.0.0";
const root = __dirname;
const dataDir = process.env.DATA_DIR || root;
const dataFile = path.join(dataDir, "reading-data.json");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("body_too_large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function readData() {
  if (!fs.existsSync(dataFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return null;
  }
}

function writeData(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf8");
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "ReadingNotebook/1.0" } }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function uniqueBooks(books) {
  const seen = new Set();
  return books.filter((book) => {
    const key = `${book.title}|${book.author}|${book.isbn}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return book.title;
  });
}

async function searchBooks(query) {
  const encoded = encodeURIComponent(query);
  const results = [];

  const google = await getJson(`https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=10`).catch(() => null);
  for (const item of google?.items || []) {
    const info = item.volumeInfo || {};
    const isbn = (info.industryIdentifiers || []).find((id) => id.type.includes("ISBN"))?.identifier || "";
    results.push({
      title: info.title || query,
      author: (info.authors || []).join("、"),
      publisher: info.publisher || "",
      isbn,
      description: info.description || "",
      cover: info.imageLinks?.thumbnail?.replace("http://", "https://") || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "")
    });
  }

  const openLibrary = await getJson(`https://openlibrary.org/search.json?q=${encoded}&limit=10`).catch(() => null);
  for (const item of openLibrary?.docs || []) {
    const isbn = item.isbn?.[0] || "";
    results.push({
      title: item.title || query,
      author: (item.author_name || []).join("、"),
      publisher: item.publisher?.[0] || "",
      isbn,
      description: item.first_sentence?.[0] || "",
      cover: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : ""
    });
  }

  const webNovel = await getJson(`https://api.zhuishushenqi.com/book/fuzzy-search?query=${encoded}`).catch(() => null);
  for (const item of webNovel?.books || []) {
    const cover = item.cover ? `https://statics.zhuishushenqi.com${item.cover}` : "";
    results.push({
      title: item.title || query,
      author: item.author || "",
      publisher: item.majorCate || item.minorCate || "网络小说",
      isbn: "",
      description: item.shortIntro || "",
      cover
    });
  }

  return uniqueBooks(results).slice(0, 12);
}

http
  .createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/search-books") {
      const query = url.searchParams.get("q")?.trim() || "";
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      if (!query) {
        response.end(JSON.stringify([]));
        return;
      }
      try {
        response.end(JSON.stringify(await searchBooks(query)));
      } catch {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: "search_failed" }));
      }
      return;
    }

    if (url.pathname === "/api/data" && request.method === "GET") {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(readData() || { books: [], activeBookId: null }));
      return;
    }

    if (url.pathname === "/api/data" && request.method === "POST") {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      try {
        const body = await readRequestBody(request);
        const data = JSON.parse(body || "{}");
        writeData(data);
        response.end(JSON.stringify({ ok: true }));
      } catch {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: "save_failed" }));
      }
      return;
    }

    const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(root, requested));

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
      response.end(content);
    });
  })
  .listen(port, host, () => {
    console.log(`Reading notebook is running at http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
  });
