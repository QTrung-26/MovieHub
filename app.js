const KK_URL = "https://phimapi.com";
const OPHIM_URL = "https://ophim1.com";

let currentCategory = "phim-moi-cap-nhat";
let pageIndex = 1;
let currentKeyword = "";

// Hàm fetch có cơ chế Timeout chống treo mạng (6 giây)
async function fetchWithTimeout(url, timeout = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 1. Lấy danh sách phim (Có Fallback sang Ophim)
async function fetchMoviesData(category, page = 1) {
  try {
    let url = `${KK_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`;
    if (["phim-le", "phim-bo", "hoat-hinh", "tv-shows"].includes(category)) {
      url = `${KK_URL}/v1/api/danh-sach/${category}?page=${page}`;
    }
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error("KKPhim error");
    const data = await res.json();
    
    window.APP_DOMAIN_CDN = data.data?.APP_DOMAIN_CDN_IMAGE || "https://img.phimapi.com";
    const items = data.data?.items || data.items || [];
    
    if (items.length > 0) {
      return {
        items: items,
        pagination: data.data?.params?.pagination || data.pagination || {}
      };
    }
    throw new Error("Empty items from KKPhim");

  } catch (err) {
    try {
      let ophimUrl = `${OPHIM_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`;
      if (["phim-le", "phim-bo", "hoat-hinh", "tv-shows"].includes(category)) {
        ophimUrl = `${OPHIM_URL}/v1/api/danh-sach/${category}?page=${page}`;
      }
      const res = await fetchWithTimeout(ophimUrl);
      const data = await res.json();
      
      window.APP_DOMAIN_CDN = data.data?.APP_DOMAIN_CDN_IMAGE || "https://img.ophim.cc/uploads/movies";
      return {
        items: data.data?.items || data.items || [],
        pagination: data.data?.params?.pagination || data.pagination || {}
      };
    } catch (fallbackErr) {
      return { items: [], pagination: {} };
    }
  }
}

// 2. Tìm kiếm phim theo từ khóa chuyên biệt (Giúp lấy đúng thể loại từng mục)
async function searchMoviesAPI(keyword) {
  if (!keyword.trim()) return [];
  try {
    const res = await fetchWithTimeout(`${KK_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=15`);
    const data = await res.json();
    window.APP_DOMAIN_CDN = data.data?.APP_DOMAIN_CDN_IMAGE || "https://img.phimapi.com";
    const items = data.data?.items || [];
    if (items.length > 0) return items;
    throw new Error("Empty search");
  } catch (err) {
    try {
      const res = await fetchWithTimeout(`${OPHIM_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=15`);
      const data = await res.json();
      window.APP_DOMAIN_CDN = data.data?.APP_DOMAIN_CDN_IMAGE || "https://img.ophim.cc/uploads/movies";
      return data.data?.items || [];
    } catch (e) {
      return [];
    }
  }
}

// 3. Lấy chi tiết phim
async function fetchMovieDetail(slug) {
  try {
    const res = await fetchWithTimeout(`${KK_URL}/phim/${slug}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data && data.movie) return data;
    throw new Error();
  } catch (err) {
    try {
      const res = await fetchWithTimeout(`${OPHIM_URL}/phim/${slug}`);
      return await res.json();
    } catch (e) {
      return null;
    }
  }
}

function getImageUrl(movie) {
  let img = movie?.poster_url || movie?.thumb_url || "";
  if (!img) return "https://via.placeholder.com/250x360?text=No+Image";
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  const cdnDomain = window.APP_DOMAIN_CDN || "https://img.phimapi.com";
  let cleanPath = img.startsWith("/") ? img : `/${img}`;
  return `${cdnDomain}${cleanPath}`;
}

// Hiển thị Banner Cinematic
function renderHeroBanner(movies) {
  if (!Array.isArray(movies) || movies.length === 0) return "";
  const movie = movies[0];
  if (!movie) return "";
  
  let img = movie.thumb_url || movie.poster_url || "";
  const cdnDomain = window.APP_DOMAIN_CDN || "https://img.phimapi.com";
  let bgImg = img.startsWith("http") ? img : `${cdnDomain}/${img}`;

  return `
    <div class="hero-banner" style="background-image: url('${bgImg}');">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-badge">Đề Cử Thịnh Hành</span>
        <h1 class="hero-title">${movie.name || 'Đang cập nhật'}</h1>
        <p class="hero-subtitle">${movie.origin_name || ''}</p>
        <p class="hero-desc">${movie.content || 'Khám phá ngay siêu phẩm đặc sắc đang làm mưa làm gió trên hệ thống MovieHub với chất lượng trình chiếu hoàn hảo.'}</p>
        <div class="hero-buttons">
          <button class="hero-btn-play" onclick="handleWatchMovie('${movie.slug}')">▶ Phát</button>
          <button class="hero-btn-info" onclick="handleWatchMovie('${movie.slug}')">ℹ Thông tin khác</button>
        </div>
      </div>
    </div>
  `;
}

// Trượt ngang carousel
window.scrollRow = function(rowId, direction) {
  const container = document.getElementById(rowId);
  if (container) {
    container.scrollBy({ left: direction * 850, behavior: 'smooth' });
  }
};

// Render hàng ngang carousel
function renderHorizontalRow(title, movies, rowId) {
  if (!Array.isArray(movies) || movies.length === 0) return "";
  const displayMovies = movies.slice(0, 12);

  return `
    <div class="movie-row-container">
      <h3 class="row-title">${title} <span>›</span></h3>
      <button class="scroll-btn left" onclick="scrollRow('${rowId}', -1)">❮</button>
      <div id="${rowId}" class="row-scroll">
        ${displayMovies.map((movie) => {
          const imgUrl = getImageUrl(movie);
          return `
            <div class="movie-card" onclick="handleWatchMovie('${movie.slug}')">
              <div class="movie-poster-wrapper">
                <span class="movie-badge">HOT</span>
                <img class="movie-poster" src="${imgUrl}" alt="${movie.name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/250x360?text=No+Image';">
              </div>
              <h4 class="movie-title" title="${movie.name}">${movie.name}</h4>
              <p class="movie-origin" title="${movie.origin_name || ''}">${movie.origin_name || ''}</p>
            </div>
          `;
        }).join('')}
      </div>
      <button class="scroll-btn right" onclick="scrollRow('${rowId}', 1)">❯</button>
    </div>
  `;
}

// Render dạng Lưới (Grid)
function renderMoviesGridUI(movies) {
  const container = document.getElementById("rows");
  if (!container) return;

  container.className = "movies-grid";
  container.innerHTML = "";

  if (!Array.isArray(movies) || movies.length === 0) {
    container.innerHTML = "<p style='color: white; text-align: center; grid-column: 1/-1;'>Không tìm thấy bộ phim nào!</p>";
    return;
  }

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "grid-card";
    const imgUrl = getImageUrl(movie);

    card.innerHTML = `
      <img class="grid-poster" src="${imgUrl}" alt="${movie.name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/220x330?text=No+Image';">
      <h4 class="movie-title" title="${movie.name}">${movie.name}</h4>
      <p class="movie-origin" title="${movie.origin_name || ''}">${movie.origin_name || ''}</p>
    `;
    card.onclick = () => handleWatchMovie(movie.slug);
    container.appendChild(card);
  });
}

// Hiển thị trình phát phim
function renderPlayerUI(movieData) {
  if (!movieData || !movieData.movie) return;
  const movie = movieData.movie;
  const servers = movieData.episodes || [];
  
  let playerContainer = document.getElementById("player-container");
  if (!playerContainer) return;

  const rowsContainer = document.getElementById("rows");
  if (rowsContainer) rowsContainer.innerHTML = "";
  const paginationDiv = document.getElementById("pagination");
  if (paginationDiv) paginationDiv.innerHTML = "";

  const serverData = servers[0]?.server_data || [];
  const defaultEmbed = serverData[0]?.link_embed || "";

  playerContainer.style.display = "block";
  
  playerContainer.innerHTML = `
    <div class="player-wrapper">
      <h2 class="player-title">${movie.name} <span class="player-origin">(${movie.origin_name || ''})</span></h2>
      
      <div class="video-container">
        <iframe id="movie-iframe" src="${defaultEmbed}" allowfullscreen></iframe>
      </div>

      ${serverData.length > 0 ? `
        <div class="episodes-section">
          <h3 class="episodes-title">Danh sách tập:</h3>
          <div class="episodes-list">
            ${serverData.map((ep, index) => `
              <button onclick="changeEpisode('${ep.link_embed}', this)" class="ep-btn ${index === 0 ? 'active' : ''}">${ep.name}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="movie-info-box">
        <h3 class="movie-info-title">Nội dung phim</h3>
        <p class="movie-desc">${movie.content || 'Đang cập nhật nội dung...'}</p>
        <div class="movie-meta">
          <span><strong>Năm:</strong> ${movie.year || 'N/A'}</span>
          <span><strong>Thời lượng:</strong> ${movie.time || 'N/A'}</span>
          <span><strong>Trạng thái:</strong> ${movie.episode_current || 'N/A'}</span>
          <span><strong>Chất lượng:</strong> ${movie.quality || 'HD'}</span>
        </div>
      </div>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.changeEpisode = function(embedUrl, buttonElement) {
  const iframe = document.getElementById("movie-iframe");
  if (iframe) iframe.src = embedUrl;
  document.querySelectorAll('.ep-btn').forEach(btn => btn.classList.remove('active'));
  buttonElement.classList.add('active');
};

function renderPaginationUI(currentPage) {
  let paginationDiv = document.getElementById("pagination");
  if (!paginationDiv) return;

  paginationDiv.innerHTML = `
    <button id="btn-prev" ${currentPage <= 1 ? "disabled" : ""}>Trang trước</button>
    <span style="color: white; font-weight: bold; margin: 0 15px;">Trang ${currentPage}</span>
    <button id="btn-next">Trang sau</button>
  `;

  document.getElementById("btn-prev").onclick = () => handlePageChange(currentPage - 1);
  document.getElementById("btn-next").onclick = () => handlePageChange(currentPage + 1);
}

// Điều khiển chính: Gọi độc lập từng API chuyên biệt cho từng mục để không bị lẫn lộn
window.loadData = async function(category = currentCategory, page = pageIndex) {
  currentCategory = category;
  pageIndex = page;
  currentKeyword = "";
  
  const playerContainer = document.getElementById("player-container");
  if (playerContainer) playerContainer.style.display = "none";
  const paginationDiv = document.getElementById("pagination");

  const container = document.getElementById("rows");
  if (container) {
    container.className = "";
    container.innerHTML = "<p style='color: white; text-align: center; padding: 40px;'>Đang tải kho phim MovieHub...</p>";
  }

  try {
    if (category === "phim-moi-cap-nhat") {
      if (paginationDiv) paginationDiv.innerHTML = ""; 

      // Gọi đồng thời các API chuyên biệt theo từng mục thể loại
      const results = await Promise.allSettled([
        fetchMoviesData("phim-moi-cap-nhat", 1),
        fetchMoviesData("phim-bo", 1),
        fetchMoviesData("phim-le", 1),
        fetchMoviesData("hoat-hinh", 1),
        searchMoviesAPI("anime"),
        searchMoviesAPI("sinh tồn"),
        searchMoviesAPI("kinh dị"),
        searchMoviesAPI("gay cấn"),
        searchMoviesAPI("việt nam")
      ]);

      const resNew = results[0].status === 'fulfilled' ? results[0].value : { items: [] };
      const resSeries = results[1].status === 'fulfilled' ? results[1].value : { items: [] };
      const resMovie = results[2].status === 'fulfilled' ? results[2].value : { items: [] };
      const resAnim = results[3].status === 'fulfilled' ? results[3].value : { items: [] };
      const resAnimeSearch = results[4].status === 'fulfilled' ? results[4].value : [];
      const resSurvival = results[5].status === 'fulfilled' ? results[5].value : [];
      const resHorror = results[6].status === 'fulfilled' ? results[6].value : [];
      const resAction = results[7].status === 'fulfilled' ? results[7].value : [];
      const resVn = results[8].status === 'fulfilled' ? results[8].value : [];

      const newItems = resNew?.items || [];
      const seriesItems = resSeries?.items || [];
      const movieItems = resMovie?.items || [];
      const cnHans = resAnim?.items || [];
      const animeItems = resAnimeSearch.length ? resAnimeSearch : cnHans;
      const survivalMovies = resSurvival.length ? resSurvival : movieItems;
      const thrillerMovies = resHorror.length ? resHorror : newItems;
      const intenseMovies = resAction.length ? resAction : seriesItems;
      const vnMovies = resVn.length ? resVn : seriesItems;

      if (container) {
        container.innerHTML = `
          ${renderHeroBanner(newItems)}
          ${renderHorizontalRow("Phim Mới Cập Nhật", newItems, "row-new")}
          ${renderHorizontalRow("Phim Bộ Đang Hot", seriesItems, "row-series")}
          ${renderHorizontalRow("Hoạt Hình Trung Quốc", cnHans, "row-cn")}
          ${renderHorizontalRow("Anime Hot", animeItems, "row-anime")}
          ${renderHorizontalRow("Ranh giới sinh tồn", survivalMovies, "row-survival")}
          ${renderHorizontalRow("Kinh dị giật gân", thrillerMovies, "row-thriller")}
          ${renderHorizontalRow("Gay cấn đến phút chót", intenseMovies, "row-intense")}
          ${renderHorizontalRow("Phim Bộ Việt Nam Đặc Sắc", vnMovies, "row-vn")}
          ${renderHorizontalRow("Phim Lẻ Đặc Sắc", movieItems, "row-movie")}
        `;
      }
    } else {
      const result = await fetchMoviesData(currentCategory, pageIndex);
      const items = result?.items || [];
      renderMoviesGridUI(items);
      renderPaginationUI(pageIndex);
    }
  } catch (err) {
    console.error("Lỗi khi tải dữ liệu:", err);
    if (container) {
      container.innerHTML = `<p style='color: #ff4757; text-align: center; padding: 40px;'>Lỗi tải trang: ${err.message}. Vui lòng kiểm tra lại kết nối mạng hoặc F5 lại!</p>`;
    }
  }
};

async function handleWatchMovie(slug) {
  const movieData = await fetchMovieDetail(slug);
  renderPlayerUI(movieData);
}

function handlePageChange(newPage) {
  if (newPage < 1) return;
  pageIndex = newPage;
  window.loadData(currentCategory, pageIndex);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  window.loadData("phim-moi-cap-nhat", 1);

  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        const keyword = searchInput.value;
        if (!keyword.trim()) return;
        currentKeyword = keyword;
        const results = await searchMoviesAPI(keyword);
        renderMoviesGridUI(results);
        const pag = document.getElementById("pagination");
        if (pag) pag.innerHTML = ""; 
      }
    });
  }
});