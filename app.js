// ============================================================
// MovieHub - script chính (đã sửa lỗi & cải tiến)
// ============================================================

// ===== Cấu hình =====
const KK_URL = "https://phimapi.com";
const OPHIM_URL = "https://ophim1.com";

const HOME_CATEGORY = "phim-moi-cap-nhat";
const REQUEST_TIMEOUT = 6000;          // ms
const CACHE_TTL = 5 * 60 * 1000;       // cache kết quả 5 phút
const DEFAULT_ROW_LIMIT = 12;
// Nếu poster dọc/ngang bị ngược (ảnh card bị cắt lạ), đổi thành true
const SWAP_IMAGES = false;

// Mỗi nguồn có domain ảnh riêng -> không còn dùng biến toàn cục window.APP_DOMAIN_CDN
const SOURCES = [
  { name: "KKPhim", url: KK_URL, imgPrefix: "", defaultImgBase: "https://img.phimapi.com" },
  { name: "OPhim", url: OPHIM_URL, imgPrefix: "/uploads/movies", defaultImgBase: "https://img.ophim.live/uploads/movies" }
];

// Các hàng trên trang chủ: lọc theo thể loại / quốc gia thật thay vì tìm từ khóa
// (đổi slug ở đây nếu muốn đổi nội dung từng hàng)
const HOME_ROWS = [
  { id: "row-new",         title: "Phim Mới Cập Nhật",              endpoint: "danh-sach/phim-moi-cap-nhat", hero: true },
  { id: "row-top-series",  title: "Top 5 Phim Bộ Đang Hot",         endpoint: "v1/api/danh-sach/phim-bo", limit: 5, ranked: true },
  { id: "row-top-kr",      title: "Top 5 Phim Hàn Không Thể Bỏ",    endpoint: "v1/api/quoc-gia/han-quoc", limit: 5, ranked: true },
  { id: "row-top-movie",   title: "Top 5 Phim Lẻ Đặc Sắc",          endpoint: "v1/api/danh-sach/phim-le", limit: 5, ranked: true },
  { id: "row-cn",          title: "Hoạt Hình Trung Quốc",           endpoint: "v1/api/danh-sach/hoat-hinh", params: { country: "trung-quoc" }, keepCn: true, onlyCountry: "trung-quoc" },
  { id: "row-anime",       title: "Anime Hot",                      endpoint: "v1/api/danh-sach/hoat-hinh", params: { country: "nhat-ban" }, onlyCountry: "nhat-ban" },
  { id: "row-survival",    title: "Ranh giới sinh tồn",             endpoint: "v1/api/the-loai/vien-tuong" },
  { id: "row-thriller",    title: "Kinh dị giật gân",               endpoint: "v1/api/the-loai/kinh-di" },
  { id: "row-intense",     title: "Gay cấn đến phút chót",          endpoint: "v1/api/the-loai/hanh-dong" },
  { id: "row-vn",          title: "Phim Bộ Việt Nam Đặc Sắc",       endpoint: "v1/api/danh-sach/phim-bo", params: { country: "viet-nam" } }
];

// ===== Trạng thái =====
let currentCategory = HOME_CATEGORY;
let pageIndex = 1;
let currentKeyword = "";
let loadToken = 0;   // chống race condition: chỉ request mới nhất được phép render
let searchToken = 0;

// ===== Tiện ích =====
const $ = (id) => document.getElementById(id);

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

// Chuyển nội dung có thể chứa HTML thành text thuần (không thực thi script)
function toPlainText(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  return (doc.body.textContent || "").trim();
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function safeHttpUrl(url) {
  return /^https?:\/\//i.test(url || "") ? url : "";
}

function cssUrl(url) {
  try {
    return new URL(url).href.replace(/['()]/g, (c) => "%" + c.charCodeAt(0).toString(16));
  } catch {
    return "";
  }
}

// Ảnh placeholder nội bộ (SVG data URI) thay cho via.placeholder.com
const PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="360" viewBox="0 0 250 360">` +
  `<rect width="100%" height="100%" fill="#1f1f1f"/>` +
  `<text x="50%" y="50%" fill="#777" font-family="sans-serif" font-size="16" ` +
  `text-anchor="middle" dominant-baseline="middle">No Image</text></svg>`
);

function joinUrl(base, path) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function resolveImage(path, base) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("//")) return "https:" + path;
  return joinUrl(base, path);
}

function getImageBase(data, source) {
  if (data?.pathImage) return data.pathImage;                       // định dạng cũ của OPhim
  const cdn = data?.data?.APP_DOMAIN_CDN_IMAGE;
  if (cdn) return cdn.replace(/\/+$/, "") + source.imgPrefix;
  return source.defaultImgBase;
}

const movieIndex = new Map(); // slug -> phim (để lưu yêu thích)

// Hoạt hình Trung Quốc chỉ hiện ở hàng riêng (và trang "Hoạt hình"), bị loại khỏi mọi danh mục khác
const cnSlugs = new Set();
let cnPromise = null;
const hasCountry = (m, slug) => Array.isArray(m.country) && m.country.some((c) => c.slug === slug);
const isCnAnimation = (m) => cnSlugs.has(m.slug) || (hasCountry(m, "trung-quoc") &&
  (m.type === "hoathinh" || (Array.isArray(m.category) && m.category.some((c) => c.slug === "hoat-hinh"))));

function loadCnSlugs() {
  cnPromise = cnPromise || (async () => {
    for (const page of [1, 2, 3]) {
      const r = await fetchList("v1/api/danh-sach/hoat-hinh", { country: "trung-quoc", page });
      r.items.filter((m) => !Array.isArray(m.country) || hasCountry(m, "trung-quoc")).forEach((m) => cnSlugs.add(m.slug));
    }
  })().catch(() => {});
  return cnPromise;
}

async function withoutCnAnimation(items) {
  await loadCnSlugs();
  return items.filter((m) => !isCnAnimation(m));
}
// poster = ảnh dọc (card), thumb = ảnh ngang (nền hero)
function normalizeMovie(movie, imgBase) {
  const a = resolveImage(movie.thumb_url, imgBase);
  const b = resolveImage(movie.poster_url, imgBase);
  const [portrait, landscape] = SWAP_IMAGES ? [b, a] : [a, b];
  const m = {
    ...movie,
    name: movie.name || "Đang cập nhật",
    origin_name: movie.origin_name || "",
    poster: portrait || landscape,
    thumb: landscape || portrait
  };
  movieIndex.set(m.slug, m);
  return m;
}

function getImageUrl(movie) {
  return movie?.poster || movie?.thumb || PLACEHOLDER;
}

function getTotalPages(pagination) {
  const p = pagination || {};
  if (Number(p.totalPages)) return Number(p.totalPages);
  if (Number(p.totalItems) && Number(p.totalItemsPerPage)) {
    return Math.ceil(Number(p.totalItems) / Number(p.totalItemsPerPage));
  }
  return null;
}

// ===== Tầng mạng =====
async function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchJSON(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const listCache = new Map();

function extractList(data) {
  return {
    items: data?.data?.items || data?.items || [],
    pagination: data?.data?.params?.pagination || data?.pagination || {}
  };
}

// Hàm tổng quát: thử lần lượt từng nguồn, trả về danh sách đã chuẩn hóa
async function fetchList(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const cacheKey = `${endpoint}?${qs}`;
  const cached = listCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.value;

  let failed = true;
  for (const source of SOURCES) {
    try {
      const data = await fetchJSON(`${source.url}/${endpoint}${qs ? "?" + qs : ""}`);
      failed = false; // server có phản hồi, dù danh sách có thể rỗng
      const { items, pagination } = extractList(data);
      const valid = items.filter((m) => m && m.slug);
      if (valid.length > 0) {
        const base = getImageBase(data, source);
        const value = { items: valid.map((m) => normalizeMovie(m, base)), pagination, failed: false };
        listCache.set(cacheKey, { time: Date.now(), value });
        return value;
      }
    } catch (err) {
      console.warn(`[${source.name}] ${endpoint} lỗi:`, err.message);
    }
  }
  return { items: [], pagination: {}, failed };
}

// Danh mục chính. Cũng hỗ trợ "the-loai/<slug>" và "quoc-gia/<slug>"
async function fetchMoviesData(category, page = 1) {
  let endpoint = "danh-sach/phim-moi-cap-nhat";
  if (["phim-le", "phim-bo", "hoat-hinh", "tv-shows"].includes(category)) {
    endpoint = `v1/api/danh-sach/${category}`;
  } else if (/^(the-loai|quoc-gia)\/[\w-]+$/.test(category)) {
    endpoint = `v1/api/${category}`;
  }
  return fetchList(endpoint, { page });
}

async function searchMoviesAPI(keyword, limit = 20) {
  if (!keyword.trim()) return [];
  const result = await fetchList("v1/api/tim-kiem", { keyword: keyword.trim(), limit });
  return result.items;
}

async function fetchMovieDetail(slug) {
  for (const source of SOURCES) {
    try {
      const data = await fetchJSON(`${source.url}/phim/${encodeURIComponent(slug)}`);
      if (data && data.movie) return data;
    } catch (err) {
      console.warn(`[${source.name}] chi tiết phim lỗi:`, err.message);
    }
  }
  return null;
}

// ===== Giao diện: Hero banner =====
// Chọn ngẫu nhiên 1 phim trong top phim mới để làm banner
function renderHeroBanner(movies) {
  const pool = (movies || []).filter((m) => m.thumb || m.poster).slice(0, 10);
  if (!pool.length) return "";
  const movie = pool[Math.floor(Math.random() * pool.length)];
  const slug = escapeHtml(movie.slug);
  const meta = [movie.year, movie.quality, movie.episode_current].filter(Boolean)
    .map((v) => `<span>${escapeHtml(v)}</span>`).join("");
  return `
    <section class="hero-banner" data-hero="${slug}" style="background-image: url('${escapeHtml(cssUrl(movie.thumb || movie.poster))}');">
      <div class="hero-overlay"></div>
      <div class="hero-inner">
        <div class="hero-content">
          <span class="hero-badge">Đang hot hôm nay</span>
          <h1 class="hero-title">${escapeHtml(movie.name)}</h1>
          <p class="hero-subtitle">${escapeHtml(movie.origin_name)}</p>
          <div class="hero-meta">${meta}</div>
          <p class="hero-desc">Đang tải nội dung phim...</p>
          <div class="hero-buttons">
            <button class="hero-btn-play" data-slug="${slug}">▶ Xem ngay</button>
            <button class="hero-btn-info fav-text${isFav(movie.slug) ? " on" : ""}" data-fav="${slug}">${HEART}<span class="t-off">Yêu thích</span><span class="t-on">Đã lưu</span></button>
          </div>
        </div>
        <img class="hero-poster" src="${escapeHtml(movie.poster || movie.thumb)}" alt="${escapeHtml(movie.name)}">
      </div>
    </section>`;
}

// Bổ sung mô tả, thể loại, quốc gia cho banner từ API chi tiết
async function enrichHero() {
  const hero = document.querySelector(".hero-banner[data-hero]");
  if (!hero) return;
  const data = await fetchMovieDetail(hero.dataset.hero);
  const m = data?.movie;
  if (!m || !document.body.contains(hero)) return;
  hero.querySelector(".hero-desc").textContent =
    truncate(toPlainText(m.content) || "Khám phá ngay siêu phẩm đang được xem nhiều trên QT.", 260);
  const tags = [...(m.category || []).slice(0, 3), ...(m.country || []).slice(0, 1)].map((t) => t.name).filter(Boolean);
  hero.querySelector(".hero-meta").insertAdjacentHTML("beforeend", tags.map((t) => `<span>${escapeHtml(t)}</span>`).join(""));
}

// ===== Giao diện: Hàng ngang (carousel) =====
window.scrollRow = function (rowId, direction) {
  const container = $(rowId);
  if (container) container.scrollBy({ left: direction * 850, behavior: "smooth" });
};

function favBtn(slug) {
  const on = isFav(slug);
  return `<button class="fav-btn${on ? " on" : ""}" data-fav="${escapeHtml(slug)}" aria-label="Lưu vào yêu thích" aria-pressed="${on}">${HEART}</button>`;
}

function renderRowCards(movies, limit = DEFAULT_ROW_LIMIT, ranked = false) {
  return movies.slice(0, limit).map((movie, i) => `
    <div class="movie-card${ranked ? " ranked" : ""}" data-slug="${escapeHtml(movie.slug)}">
      <div class="movie-poster-wrapper">
        ${movie.episode_current ? `<span class="movie-badge">${escapeHtml(movie.episode_current)}</span>` : ""}
        ${ranked ? `<span class="rank-num">${i + 1}</span>` : ""}
        ${favBtn(movie.slug)}
        <img class="movie-poster" src="${escapeHtml(getImageUrl(movie))}" alt="${escapeHtml(movie.name)}" loading="lazy" decoding="async">
      </div>
      <h4 class="movie-title" title="${escapeHtml(movie.name)}">${escapeHtml(movie.name)}</h4>
      <p class="movie-origin" title="${escapeHtml(movie.origin_name)}">${escapeHtml(movie.origin_name)}</p>
    </div>
  `).join("");
}

function renderRowShell(title, rowId, innerHtml, loading = false) {
  return `
    <div class="movie-row-container${loading ? " is-loading" : ""}" id="wrap-${rowId}">
      <h3 class="row-title">${escapeHtml(title)} <span>›</span></h3>
      <button class="scroll-btn left" data-scroll="${rowId}" data-dir="-1" aria-label="Cuộn trái">❮</button>
      <div id="${rowId}" class="row-scroll">${innerHtml}</div>
      <button class="scroll-btn right" data-scroll="${rowId}" data-dir="1" aria-label="Cuộn phải">❯</button>
    </div>
  `;
}

// Giữ lại hàm cũ (có thêm tham số limit)
function renderHorizontalRow(title, movies, rowId, limit = DEFAULT_ROW_LIMIT) {
  if (!Array.isArray(movies) || movies.length === 0) return "";
  return renderRowShell(title, rowId, renderRowCards(movies, limit));
}

function renderSkeletonCards(count = 8) {
  return Array.from({ length: count }, () =>
    `<div class="movie-card skeleton-card"><div class="skeleton-block"></div></div>`
  ).join("");
}

// ===== Giao diện: Lưới =====
function renderMoviesGridUI(movies, emptyMsg = "Không tìm thấy bộ phim nào!") {
  const container = $("rows");
  if (!container) return;
  container.className = "movies-grid";
  if (!Array.isArray(movies) || movies.length === 0) {
    container.innerHTML = `<p style='color: white; text-align: center; grid-column: 1/-1; padding: 40px 0;'>${escapeHtml(emptyMsg)}</p>`;
    return;
  }
  container.innerHTML = movies.map((movie) => `
    <div class="grid-card" data-slug="${escapeHtml(movie.slug)}">
      ${favBtn(movie.slug)}
      <img class="grid-poster" src="${escapeHtml(getImageUrl(movie))}" alt="${escapeHtml(movie.name)}" loading="lazy" decoding="async">
      <h4 class="movie-title" title="${escapeHtml(movie.name)}">${escapeHtml(movie.name)}</h4>
      <p class="movie-origin" title="${escapeHtml(movie.origin_name)}">${escapeHtml(movie.origin_name)}</p>
    </div>
  `).join("");
}

// ===== Giao diện: Trình phát =====
function renderPlayerUI(movieData) {
  if (!movieData || !movieData.movie) return;
  const movie = movieData.movie;
  if (!movieIndex.has(movie.slug)) normalizeMovie(movie, SOURCES[0].defaultImgBase);
  const servers = movieData.episodes || [];

  const playerContainer = $("player-container");
  if (!playerContainer) return;

  const rowsContainer = $("rows");
  if (rowsContainer) rowsContainer.innerHTML = "";
  const paginationDiv = $("pagination");
  if (paginationDiv) paginationDiv.innerHTML = "";

  const serverData = servers[0]?.server_data || [];
  const saved = getHist().find((h) => h.slug === movie.slug);
  const startIdx = saved && saved.epIndex < serverData.length ? saved.epIndex : 0;
  const defaultEmbed = safeHttpUrl(serverData[startIdx]?.link_embed);
  const description = toPlainText(movie.content) || "Đang cập nhật nội dung...";
  player = { movie, total: serverData.length, names: serverData.map((e) => e.name) };
  if (player.total) recordWatch(movie, startIdx, player.total, serverData[startIdx].name);
  const isDone = !!getHist().find((h) => h.slug === movie.slug)?.done;

  playerContainer.style.display = "block";
  playerContainer.innerHTML = `
    <div class="player-wrapper">
      <div class="player-head"><h2 class="player-title">${escapeHtml(movie.name)} <span class="player-origin">(${escapeHtml(movie.origin_name || "")})</span></h2>
        <button class="hero-btn-info fav-text${isFav(movie.slug) ? " on" : ""}" data-fav="${escapeHtml(movie.slug)}">${HEART}<span class="t-off">Yêu thích</span><span class="t-on">Đã lưu</span></button>
        ${serverData.length ? `<button class="hero-btn-info fav-text done-btn${isDone ? " on" : ""}" data-done="${escapeHtml(movie.slug)}"><span class="t-off">Đánh dấu đã xem</span><span class="t-on">✓ Đã xem</span></button>` : ""}</div>

      <div class="video-container">
        ${defaultEmbed
          ? `<iframe id="movie-iframe" src="${escapeHtml(defaultEmbed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
          : `<p style="color:white; text-align:center; padding:40px;">Phim chưa có nguồn phát. Vui lòng quay lại sau!</p>`}
      </div>

      ${serverData.length > 0 ? `
        <div class="episodes-section">
          <h3 class="episodes-title">Danh sách tập:</h3>
          <div class="episodes-list">
            ${serverData.map((ep, index) => `
              <button class="ep-btn ${index === startIdx ? "active" : ""}" data-idx="${index}" data-embed="${escapeHtml(safeHttpUrl(ep.link_embed))}">${escapeHtml(ep.name)}</button>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <div class="movie-info-box">
        <h3 class="movie-info-title">Nội dung phim</h3>
        <p class="movie-desc">${escapeHtml(description)}</p>
        <div class="movie-meta">
          <span><strong>Năm:</strong> ${escapeHtml(movie.year || "N/A")}</span>
          <span><strong>Thời lượng:</strong> ${escapeHtml(movie.time || "N/A")}</span>
          <span><strong>Trạng thái:</strong> ${escapeHtml(movie.episode_current || "N/A")}</span>
          <span><strong>Chất lượng:</strong> ${escapeHtml(movie.quality || "HD")}</span>
        </div>
      </div>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.changeEpisode = function (embedUrl, buttonElement) {
  const url = safeHttpUrl(embedUrl);
  const iframe = $("movie-iframe");
  if (iframe && url) iframe.src = url;
  document.querySelectorAll(".ep-btn").forEach((btn) => btn.classList.remove("active"));
  if (buttonElement) buttonElement.classList.add("active");
};

function hidePlayer() {
  const playerContainer = $("player-container");
  if (playerContainer) {
    playerContainer.style.display = "none";
    playerContainer.innerHTML = "";
  }
}

// ===== Phân trang (dựa trên dữ liệu pagination của API) =====
function renderPaginationUI(currentPage, totalPages = null) {
  const paginationDiv = $("pagination");
  if (!paginationDiv) return;

  const isLast = totalPages ? currentPage >= totalPages : false;
  paginationDiv.innerHTML = `
    <button id="btn-prev" ${currentPage <= 1 ? "disabled" : ""}>Trang trước</button>
    <span style="color: white; font-weight: bold; margin: 0 15px;">Trang ${currentPage}${totalPages ? " / " + totalPages : ""}</span>
    <button id="btn-next" ${isLast ? "disabled" : ""}>Trang sau</button>
  `;

  $("btn-prev").onclick = () => handlePageChange(currentPage - 1);
  $("btn-next").onclick = () => handlePageChange(currentPage + 1);
}

// ===== Trang chủ: mỗi hàng tự tải và tự hiển thị độc lập =====
async function loadRow(cfg, token) {
  const result = await fetchList(cfg.endpoint, cfg.params);
  let items = result.items;
  if (cfg.onlyCountry) items = items.filter((m) => !Array.isArray(m.country) || hasCountry(m, cfg.onlyCountry));
  if (!cfg.keepCn) items = await withoutCnAnimation(items);
  if (token !== loadToken) return;

  const wrap = $(`wrap-${cfg.id}`);
  const rowEl = $(cfg.id);
  if (!wrap || !rowEl) return;

  if (items.length === 0) {
    if (result.failed) {
      rowEl.innerHTML = `<p class="row-error" style="color:#ff4757; padding:20px;">
        Không tải được hàng này. <button data-retry="${cfg.id}">Thử lại</button></p>`;
      wrap.classList.remove("is-loading");
    } else {
      wrap.remove(); // không có phim -> ẩn hàng
    }
    if (cfg.hero) $("hero-slot")?.remove();
    return;
  }

  rowEl.innerHTML = renderRowCards(items, cfg.limit || DEFAULT_ROW_LIMIT, cfg.ranked);
  wrap.classList.remove("is-loading");

  if (cfg.hero) {
    const slot = $("hero-slot");
    if (slot) { slot.innerHTML = renderHeroBanner(items); enrichHero(); }
  }
}

async function loadHome(token) {
  const container = $("rows");
  if (!container) return;
  container.className = "";
  const shells = HOME_ROWS.map((cfg) => renderRowShell(cfg.title, cfg.id, renderSkeletonCards(), true));
  container.innerHTML =
    `<div id="hero-slot"><div class="hero-skeleton"></div></div>` +
    `<div id="history-slot"></div>` +
    shells.slice(0, 4).join("") +
    `<div id="upcoming-slot"></div>` +
    shells.slice(4).join("");
  renderHistorySection();
  await Promise.allSettled([...HOME_ROWS.map((cfg) => loadRow(cfg, token)), loadUpcoming(token)]);
}

// ===== Điều khiển chính =====
// category: "phim-moi-cap-nhat" | "phim-le" | "phim-bo" | "hoat-hinh" | "tv-shows"
//           | "the-loai/<slug>" (vd: the-loai/kinh-di) | "quoc-gia/<slug>" (vd: quoc-gia/han-quoc)
window.loadData = async function (category = currentCategory, page = pageIndex) {
  currentCategory = category;
  pageIndex = page;
  currentKeyword = "";
  const token = ++loadToken;

  hidePlayer();
  const paginationDiv = $("pagination");
  if (paginationDiv) paginationDiv.innerHTML = "";

  try {
    if (category === "favorites") {
      const favs = getFavs();
      favs.forEach((m) => movieIndex.set(m.slug, m));
      renderMoviesGridUI(favs, "Bạn chưa lưu phim nào. Bấm biểu tượng trái tim trên poster để lưu vào đây!");
      return;
    }
    if (category === HOME_CATEGORY) {
      await loadHome(token);
      return;
    }

    const container = $("rows");
    if (container) {
      container.className = "";
      container.innerHTML = "<p style='color: white; text-align: center; padding: 40px;'>Đang tải kho phim MovieHub...</p>";
    }

    const result = await fetchMoviesData(category, page);
    if (category !== "hoat-hinh") result.items = await withoutCnAnimation(result.items);
    if (token !== loadToken) return;

    renderMoviesGridUI(result.items);
    renderPaginationUI(page, getTotalPages(result.pagination));
  } catch (err) {
    console.error("Lỗi khi tải dữ liệu:", err);
    const container = $("rows");
    if (container && token === loadToken) {
      container.className = "";
      container.innerHTML = `<p style='color: #ff4757; text-align: center; padding: 40px;'>Lỗi tải trang: ${escapeHtml(err.message)}. Vui lòng kiểm tra lại kết nối mạng hoặc F5 lại!</p>`;
    }
  }
};

async function handleWatchMovie(slug) {
  if (!slug) return;
  const movieData = await fetchMovieDetail(slug);
  if (!movieData) {
    alert("Không tải được thông tin phim. Vui lòng thử lại!");
    return;
  }
  loadToken++; // hủy các hàng trang chủ đang tải dở
  renderPlayerUI(movieData);
}
window.handleWatchMovie = handleWatchMovie; // tương thích code HTML cũ gọi onclick trực tiếp

function handlePageChange(newPage) {
  if (newPage < 1) return;
  pageIndex = newPage;
  window.loadData(currentCategory, pageIndex);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Gõ đúng tên thể loại / quốc gia / danh mục thì mở thẳng mục đó
const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().trim();
const SEARCH_SHORTCUTS = {};
[
  ["Phim bộ", "phim-bo"], ["Phim lẻ", "phim-le"], ["Hoạt hình", "hoat-hinh"], ["TV Shows", "tv-shows"],
  ["Hành động", "the-loai/hanh-dong"], ["Kinh dị", "the-loai/kinh-di"], ["Viễn tưởng", "the-loai/vien-tuong"],
  ["Tình cảm", "the-loai/tinh-cam"], ["Hài hước", "the-loai/hai-huoc"], ["Cổ trang", "the-loai/co-trang"],
  ["Hình sự", "the-loai/hinh-su"], ["Phiêu lưu", "the-loai/phieu-luu"], ["Chiến tranh", "the-loai/chien-tranh"],
  ["Tâm lý", "the-loai/tam-ly"], ["Việt Nam", "quoc-gia/viet-nam"], ["Hàn Quốc", "quoc-gia/han-quoc"],
  ["Trung Quốc", "quoc-gia/trung-quoc"], ["Nhật Bản", "quoc-gia/nhat-ban"], ["Âu Mỹ", "quoc-gia/au-my"],
  ["Thái Lan", "quoc-gia/thai-lan"], ["Đài Loan", "quoc-gia/dai-loan"], ["Hồng Kông", "quoc-gia/hong-kong"]
].forEach(([label, cat]) => { SEARCH_SHORTCUTS[norm(label)] = { label, cat }; });

async function handleSearch(keyword) {
  keyword = (keyword || "").trim();
  if (!keyword) return;
  const shortcut = SEARCH_SHORTCUTS[norm(keyword)];
  if (shortcut && window.openCategory) { window.openCategory(shortcut.cat, shortcut.label); return; }

  currentKeyword = keyword;
  const token = ++searchToken;
  loadToken++; // hủy tải trang chủ đang dở

  hidePlayer();
  const label = $("section-label");
  if (label) label.textContent = "Kết quả cho “" + keyword + "”";
  document.querySelectorAll(".chip.active").forEach((c) => c.classList.remove("active"));

  const container = $("rows");
  if (container) {
    container.className = "";
    container.innerHTML = "<p style='color: white; text-align: center; padding: 40px;'>Đang tìm kiếm...</p>";
  }
  const pag = $("pagination");
  if (pag) pag.innerHTML = "";

  const results = await searchMoviesAPI(keyword);
  if (token !== searchToken) return;
  renderMoviesGridUI(results);
}

// ===== Style bổ sung cho skeleton loading =====
function injectStyles() {
  if ($("moviehub-extra-style")) return;
  const style = document.createElement("style");
  style.id = "moviehub-extra-style";
  style.textContent = `
    .skeleton-card { pointer-events: none; }
    .skeleton-block, .hero-skeleton {
      background: linear-gradient(90deg, #222 25%, #333 50%, #222 75%);
      background-size: 200% 100%;
      animation: moviehub-shimmer 1.2s infinite linear;
    }
    .skeleton-block { width: 100%; aspect-ratio: 250 / 360; border-radius: 8px; }
    .hero-skeleton { width: 100%; height: 70vh; min-height: 360px; }
    .movie-row-container.is-loading .scroll-btn { display: none; }
    .row-error button { margin-left: 8px; cursor: pointer; }
    @keyframes moviehub-shimmer { to { background-position: -200% 0; } }
  `;
  document.head.appendChild(style);
}

// ===== Sự kiện (event delegation: không còn onclick inline) =====
document.addEventListener("click", (e) => {
  const favEl = e.target.closest("[data-fav]");
  if (favEl) { toggleFav(favEl.dataset.fav); return; }
  const delEl = e.target.closest("[data-hist-del]");
  if (delEl) { setHist(getHist().filter((h) => h.slug !== delEl.dataset.histDel)); renderHistorySection(); return; }
  const tabEl = e.target.closest("[data-hist-tab]");
  if (tabEl) { histTab = tabEl.dataset.histTab; renderHistorySection(); return; }
  const doneEl = e.target.closest("[data-done]");
  if (doneEl) { toggleDone(doneEl.dataset.done); return; }
  const remindEl = e.target.closest("[data-remind]");
  if (remindEl) { toggleRemind(remindEl.dataset.remind); return; }
  const shareEl = e.target.closest("[data-share]");
  if (shareEl) { shareMovie(shareEl.dataset.share); return; }
  const upEl = e.target.closest("[data-up]");
  if (upEl) { showUpcoming(Number(upEl.dataset.up)); startUpTimer(); return; }

  const scrollBtn = e.target.closest("[data-scroll]");
  if (scrollBtn) {
    window.scrollRow(scrollBtn.dataset.scroll, Number(scrollBtn.dataset.dir) || 1);
    return;
  }

  const retryBtn = e.target.closest("[data-retry]");
  if (retryBtn) {
    const cfg = HOME_ROWS.find((r) => r.id === retryBtn.dataset.retry);
    const rowEl = cfg && $(cfg.id);
    if (cfg && rowEl) {
      rowEl.innerHTML = renderSkeletonCards();
      $(`wrap-${cfg.id}`)?.classList.add("is-loading");
      loadRow(cfg, loadToken);
    }
    return;
  }

  const epBtn = e.target.closest(".ep-btn[data-embed]");
  if (epBtn) {
    window.changeEpisode(epBtn.dataset.embed, epBtn);
    trackEpisode(Number(epBtn.dataset.idx));
    return;
  }

  const card = e.target.closest("[data-slug]");
  if (card) handleWatchMovie(card.dataset.slug);
});

// Ảnh lỗi -> thay bằng placeholder (sự kiện error không nổi bọt nên dùng capture)
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img && img.tagName === "IMG" && !img.dataset.fallback) {
    img.dataset.fallback = "1";
    img.src = PLACEHOLDER;
  }
}, true);

// ===== Lưu cục bộ, tài khoản, yêu thích, thông báo =====
const HEART = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/></svg>';
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Tài khoản lưu ngay trong trình duyệt (chưa có máy chủ). Đăng nhập/đăng ký nằm ở login.html
const Auth = {
  user: () => lsGet("qt_session", null),
  logout() { localStorage.removeItem("qt_session"); window.QTAuth?.signOut().catch(() => {}); }
};

const favKey = () => "qt_fav_" + (Auth.user()?.id || "guest");
const getFavs = () => lsGet(favKey(), []);
const isFav = (slug) => getFavs().some((m) => m.slug === slug);

function toast(msg) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function refreshHearts() {
  document.querySelectorAll("[data-fav]").forEach((b) => { const on = isFav(b.dataset.fav); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  const n = getFavs().length, c = $("fav-count");
  if (c) { c.textContent = n; c.hidden = n === 0; }
}

function toggleFav(slug) {
  const favs = getFavs(), exists = favs.some((m) => m.slug === slug), m = movieIndex.get(slug);
  if (!exists && !m) return;
  lsSet(favKey(), exists ? favs.filter((x) => x.slug !== slug)
    : [{ slug, name: m.name, origin_name: m.origin_name, poster: m.poster, thumb: m.thumb, episode_current: m.episode_current, year: m.year, quality: m.quality }, ...favs]);
  refreshHearts();
  toast(exists ? "Đã bỏ khỏi yêu thích" : "Đã lưu vào yêu thích");
  if (currentCategory === "favorites") window.loadData("favorites", 1);
}

// Thông báo: phim mới cập nhật, ưu tiên phim bạn đã lưu
let notifItems = [];
const notifKey = (m) => m.slug + "|" + (m.episode_current || "");

function renderNotifications() {
  const seen = new Set(lsGet("qt_seen", [])), favSlugs = new Set(getFavs().map((m) => m.slug));
  const unread = notifItems.filter((m) => !seen.has(notifKey(m))).length;
  const badge = $("bell-badge");
  if (badge) { badge.textContent = unread; badge.hidden = unread === 0; }
  const list = $("notif-list");
  if (!list) return;
  list.innerHTML = notifItems.length ? notifItems.map((m) => `
    <button class="notif-item${seen.has(notifKey(m)) ? "" : " unread"}" data-slug="${escapeHtml(m.slug)}">
      <img src="${escapeHtml(getImageUrl(m))}" alt="" loading="lazy">
      <span><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.episode_current || "Mới cập nhật")}${isReminded(m.slug) ? " · Phim bạn đặt lịch đã ra mắt" : favSlugs.has(m.slug) ? " · Phim bạn đã lưu" : ""}</small></span>
    </button>`).join("") : `<p class="notif-empty">Chưa có thông báo mới.</p>`;
}

async function buildNotifications() {
  const r = await fetchList("danh-sach/phim-moi-cap-nhat", { page: 1 });
  const favSlugs = new Set(getFavs().map((m) => m.slug));
  notifItems = [...r.items].sort((a, b) => (favSlugs.has(b.slug) || isReminded(b.slug)) - (favSlugs.has(a.slug) || isReminded(a.slug))).slice(0, 8);
  renderNotifications();
}

function syncAccount() {
  const u = Auth.user();
  const guest = $("guest-actions"), btn = $("user-btn");
  if (guest) guest.hidden = !!u;
  if (btn) btn.hidden = !u;
  if (u && btn) {
    btn.textContent = u.photo ? "" : u.name.trim().charAt(0).toUpperCase();
    btn.style.backgroundImage = u.photo ? `url('${cssUrl(u.photo)}')` : "";
    if ($("user-name")) $("user-name").textContent = u.name;
    if ($("user-email")) $("user-email").textContent = u.email;
  }
  refreshHearts();
  buildNotifications();
}

function initSettings() {
  const dlg = $("settings-dialog");
  if (!dlg) return;
  const setAccent = (c) => {
    document.documentElement.style.setProperty("--accent", c);
    dlg.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("active", b.dataset.color === c));
  };
  setAccent(lsGet("qt_settings", {}).accent || "#2aa8ff");
  dlg.querySelectorAll(".swatch").forEach((b) => b.addEventListener("click", () => {
    setAccent(b.dataset.color);
    lsSet("qt_settings", { ...lsGet("qt_settings", {}), accent: b.dataset.color });
  }));
  $("settings-btn")?.addEventListener("click", (e) => { e.stopPropagation(); dlg.showModal(); });
  $("settings-close")?.addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  $("clear-favs")?.addEventListener("click", () => {
    if (!confirm("Xóa toàn bộ phim yêu thích của tài khoản này?")) return;
    lsSet(favKey(), []); refreshHearts(); toast("Đã xóa danh sách yêu thích");
    if (currentCategory === "favorites") window.loadData("favorites", 1);
  });
  $("reset-notifs")?.addEventListener("click", () => { localStorage.removeItem("qt_seen"); renderNotifications(); toast("Đã đặt lại thông báo"); });
}

function initAccountUI() {
  const on = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
  const closeAll = () => ["notif-panel", "user-panel"].forEach((id) => { const p = $(id); if (p) p.hidden = true; });

  on("bell-btn", "click", (e) => {
    e.stopPropagation();
    const p = $("notif-panel"), opening = p.hidden;
    closeAll(); p.hidden = !opening;
    if (opening) { // đánh dấu đã đọc (vẫn giữ nền nổi bật cho lần mở này)
      lsSet("qt_seen", [...new Set([...lsGet("qt_seen", []), ...notifItems.map(notifKey)])].slice(-200));
      $("bell-badge").hidden = true;
    }
  });
  on("user-btn", "click", (e) => {
    e.stopPropagation();
    const p = $("user-panel"), opening = p.hidden;
    closeAll(); p.hidden = !opening;
  });
  on("logout-btn", "click", () => {
    Auth.logout(); syncAccount(); toast("Đã đăng xuất");
    if (currentCategory === "favorites") window.loadData("favorites", 1);
  });
  document.addEventListener("click", closeAll);
  window.addEventListener("qt-auth-change", () => {
    syncAccount(); renderHistorySection();
    if (currentCategory === "favorites") window.loadData("favorites", 1);
  });
  initSettings();
  syncAccount();
}

// ===== Lịch sử xem, sắp công chiếu, đặt lịch, chia sẻ =====
const BELL = '<svg class="ico" viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/></svg>';
const SHARE = '<svg class="ico" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.9l7.6-4.3M8.2 13.1l7.6 4.3"/></svg>';
const userKey = (p) => p + (Auth.user()?.id || "guest");

// Lịch sử: "Đang xem" (có tập đang dở) và "Đã xem" (xem tới tập cuối hoặc tự đánh dấu)
const getHist = () => lsGet(userKey("qt_hist_"), []);
const setHist = (list) => lsSet(userKey("qt_hist_"), list.slice(0, 60));
let histTab = "watching";
let player = null; // phim đang mở trong trình phát

function recordWatch(movie, idx, total, epName) {
  const all = getHist(), prev = all.find((h) => h.slug === movie.slug), m = movieIndex.get(movie.slug) || {};
  const done = prev?.manual ? prev.done : total > 1 && idx >= total - 1;
  setHist([
    { slug: movie.slug, name: movie.name, origin_name: movie.origin_name || "", poster: m.poster || "", thumb: m.thumb || "",
      ep: epName || "", epIndex: idx, total, done, manual: !!prev?.manual, time: Date.now() },
    ...all.filter((h) => h.slug !== movie.slug)
  ]);
}

function trackEpisode(idx) { if (player?.total) recordWatch(player.movie, idx, player.total, player.names[idx]); }

function toggleDone(slug) {
  const all = getHist(), h = all.find((x) => x.slug === slug);
  if (!h) return;
  h.done = !h.done; h.manual = true;
  setHist(all);
  document.querySelectorAll(`[data-done="${CSS.escape(slug)}"]`).forEach((b) => b.classList.toggle("on", h.done));
  toast(h.done ? "Đã chuyển sang mục Đã xem" : "Đã chuyển về mục Đang xem");
}

function historyCard(h) {
  const pct = h.total > 1 ? Math.round(((h.epIndex + 1) / h.total) * 100) : 0;
  return `
    <div class="movie-card" data-slug="${escapeHtml(h.slug)}">
      <div class="movie-poster-wrapper">
        ${h.ep ? `<span class="movie-badge">${escapeHtml(h.ep)}</span>` : ""}
        <button class="hist-x" data-hist-del="${escapeHtml(h.slug)}" aria-label="Xóa khỏi lịch sử">×</button>
        <img class="movie-poster" src="${escapeHtml(h.poster || h.thumb || PLACEHOLDER)}" alt="${escapeHtml(h.name)}" loading="lazy" decoding="async">
        ${!h.done && pct ? `<span class="progress"><i style="width:${pct}%"></i></span>` : ""}
      </div>
      <h4 class="movie-title" title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</h4>
      <p class="movie-origin">${h.done ? "Đã xem xong" : "Xem tiếp " + escapeHtml(h.ep || "")}</p>
    </div>`;
}

function renderHistorySection() {
  const slot = $("history-slot");
  if (!slot) return;
  const all = getHist();
  if (!all.length) { slot.innerHTML = ""; return; }
  const watching = all.filter((h) => !h.done), finished = all.filter((h) => h.done);
  if (histTab === "watching" && !watching.length) histTab = "done";
  if (histTab === "done" && !finished.length) histTab = "watching";
  const list = histTab === "done" ? finished : watching;
  slot.innerHTML = `
    <div class="movie-row-container history" id="wrap-row-history">
      <div class="hist-head">
        <h3 class="row-title">Lịch sử xem</h3>
        <div class="hist-tabs">
          <button class="tab${histTab === "watching" ? " active" : ""}" data-hist-tab="watching">Đang xem <b>${watching.length}</b></button>
          <button class="tab${histTab === "done" ? " active" : ""}" data-hist-tab="done">Đã xem <b>${finished.length}</b></button>
        </div>
      </div>
      <button class="scroll-btn left" data-scroll="row-history" data-dir="-1" aria-label="Cuộn trái">❮</button>
      <div id="row-history" class="row-scroll">${list.map(historyCard).join("")}</div>
      <button class="scroll-btn right" data-scroll="row-history" data-dir="1" aria-label="Cuộn phải">❯</button>
    </div>`;
}

// Đặt lịch: nhắc trong chuông thông báo khi phim sắp chiếu xuất hiện ở danh sách phim mới
const getRemind = () => lsGet(userKey("qt_remind_"), []);
const isReminded = (slug) => getRemind().some((m) => m.slug === slug);

function toggleRemind(slug) {
  const list = getRemind(), exists = list.some((m) => m.slug === slug), m = movieIndex.get(slug);
  if (!exists && !m) return;
  lsSet(userKey("qt_remind_"), exists ? list.filter((x) => x.slug !== slug) : [{ slug, name: m.name }, ...list]);
  document.querySelectorAll(`[data-remind="${CSS.escape(slug)}"]`).forEach((b) => b.classList.toggle("on", !exists));
  toast(exists ? "Đã hủy đặt lịch" : "Đã đặt lịch, QT sẽ báo ở chuông khi phim ra mắt");
  buildNotifications();
}

async function shareMovie(slug) {
  const url = `${location.origin}${location.pathname}?phim=${encodeURIComponent(slug)}`;
  try {
    if (navigator.share) { await navigator.share({ title: movieIndex.get(slug)?.name || "QT", url }); return; }
    await navigator.clipboard.writeText(url);
    toast("Đã sao chép liên kết phim");
  } catch { /* người dùng đóng hộp chia sẻ */ }
}

// Sắp công chiếu: banner lớn, đổi phim bằng thanh bên dưới (tự chuyển mỗi 8 giây)
let upList = [], upIdx = 0, upTimer = null;
const upCache = new Map();

function startUpTimer() {
  clearInterval(upTimer);
  upTimer = setInterval(() => { if (!$("upcoming")) clearInterval(upTimer); else showUpcoming((upIdx + 1) % upList.length); }, 8000);
}

async function loadUpcoming(token) {
  const r = await fetchList("v1/api/danh-sach/phim-sap-chieu");
  const items = await withoutCnAnimation(r.items);
  if (token !== loadToken) return;
  const slot = $("upcoming-slot");
  if (!slot) return;
  upList = items.filter((m) => m.thumb || m.poster).slice(0, 5);
  if (!upList.length) { slot.remove(); return; }
  slot.innerHTML = `<section class="upcoming" id="upcoming"><div class="up-slide" id="up-slide"></div><div class="up-bars" id="up-bars"></div></section>`;
  showUpcoming(0);
  startUpTimer();
}

function showUpcoming(i) {
  const m = upList[i];
  if (!m || !$("up-slide")) return;
  upIdx = i;
  $("up-slide").innerHTML = `
    <div class="up-text">
      <span class="up-tag">Sắp công chiếu</span>
      <h2 class="up-title">${escapeHtml(m.name)}</h2>
      <p class="up-origin">${escapeHtml(m.origin_name)}</p>
      <div class="up-badges" id="up-badges"></div>
      <p class="up-meta" id="up-meta">${escapeHtml([m.year, m.episode_current].filter(Boolean).join(" · "))}</p>
      <p class="up-date" id="up-date"></p>
      <div class="up-actions">
        <button class="up-remind fav-text${isReminded(m.slug) ? " on" : ""}" data-remind="${escapeHtml(m.slug)}">${BELL}<span class="t-off">Đặt lịch</span><span class="t-on">Đã đặt lịch</span></button>
        <button class="up-share" data-share="${escapeHtml(m.slug)}" aria-label="Chia sẻ">${SHARE}</button>
      </div>
    </div>
    <div class="up-img"><img src="${escapeHtml(m.thumb || m.poster)}" alt="${escapeHtml(m.name)}" loading="lazy"></div>`;
  $("up-bars").innerHTML = upList.map((_, k) => `<button class="up-bar${k === i ? " active" : ""}" data-up="${k}" aria-label="Phim sắp chiếu ${k + 1}"></button>`).join("");
  enrichUpcoming(m.slug);
}

async function enrichUpcoming(slug) {
  let d = upCache.get(slug);
  if (!d) { d = (await fetchMovieDetail(slug))?.movie; if (d) upCache.set(slug, d); }
  if (!d || upList[upIdx]?.slug !== slug || !$("up-badges")) return;
  const eps = String(d.episode_total || "").trim();
  const total = /^\d+$/.test(eps) ? eps + " tập" : eps;
  $("up-badges").innerHTML = [d.quality, d.lang].filter(Boolean).map((v) => `<span>${escapeHtml(v)}</span>`).join("");
  $("up-meta").textContent = [d.year, total, (d.country || []).map((c) => c.name).join(", ")].filter(Boolean).join(" · ");
  $("up-date").textContent = d.showtimes ? "Lịch chiếu: " + d.showtimes : d.year ? "Dự kiến công chiếu năm " + d.year : "";
  const t = safeHttpUrl(d.trailer_url);
  if (t) document.querySelector(".up-actions")?.insertAdjacentHTML("beforeend", `<a class="up-trailer" href="${escapeHtml(t)}" target="_blank" rel="noopener noreferrer">Xem trailer</a>`);
}

function init() {
  injectStyles();
  window.loadData(HOME_CATEGORY, 1); // luôn tải phim trước, không phụ thuộc phần tài khoản
  try { initAccountUI(); } catch (err) { console.error("Lỗi khởi tạo giao diện tài khoản:", err); }
  const shared = new URLSearchParams(location.search).get("phim"); // liên kết chia sẻ ?phim=<slug>
  if (shared) handleWatchMovie(shared);

  const searchInput = $("search");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSearch(searchInput.value); });
    $("search-btn")?.addEventListener("click", () => handleSearch(searchInput.value));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}