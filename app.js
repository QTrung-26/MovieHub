const BASE_URL = "https://phimapi.com";
let currentCategory = "phim-moi-cap-nhat";
let pageIndex = 1;
let currentKeyword = "";

// 1. Gọi API lấy danh sách phim theo thể loại/trang
async function fetchMovies(category, page) {
  try {
    let url = `${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`;
    if (["phim-le", "phim-bo", "hoat-hinh", "tv-shows"].includes(category)) {
      url = `${BASE_URL}/v1/api/danh-sach/${category}?page=${page}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    
    // Lấy domain CDN trả về trực tiếp từ API nếu có (rất quan trọng để không bị lỗi ảnh)
    window.APP_DOMAIN_CDN = data.data?.APP_DOMAIN_CDN_IMAGE || "https://img.phimapi.com";

    return {
      items: data.data?.items || data.items || [],
      pagination: data.data?.params?.pagination || data.pagination || {}
    };
  } catch (err) {
    console.error("Lỗi gọi API fetchMovies:", err);
    return { items: [], pagination: {} };
  }
}

// 2. Tìm kiếm phim theo từ khóa
async function searchMoviesAPI(keyword) {
  if (!keyword.trim()) return [];
  try {
    const res = await fetch(`${BASE_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=24`);
    const data = await res.json();
    window.APP_DOMAIN_CDN = data.data?.APP_DOMAIN_CDN_IMAGE || "https://img.phimapi.com";
    return data.data?.items || [];
  } catch (err) {
    console.error("Lỗi tìm kiếm:", err);
    return [];
  }
}

// 3. Lấy chi tiết phim và link embed xem phim
async function fetchMovieDetail(slug) {
  try {
    const res = await fetch(`${BASE_URL}/phim/${slug}`);
    return await res.json();
  } catch (err) {
    console.error("Lỗi chi tiết phim:", err);
    return null;
  }
}

// --- XỬ LÝ GIAO DIỆN (UI) ---
function getImageUrl(movie) {
  let img = movie.poster_url || movie.thumb_url || "";
  if (!img) return "https://via.placeholder.com/180x260?text=No+Image";
  
  // Nếu đường dẫn đã là http hoặc https đầy đủ thì dùng luôn
  if (img.startsWith("http://") || img.startsWith("https://")) {
    return img;
  }

  // Nếu là đường dẫn tương đối, ghép với domain CDN lấy từ API
  const cdnDomain = window.APP_DOMAIN_CDN || "https://img.phimapi.com";
  let cleanPath = img.startsWith("/") ? img : `/${img}`;
  return `${cdnDomain}${cleanPath}`;
}

function renderMoviesUI(movies) {
  const container = document.getElementById("rows") || document.querySelector("main");
  if (!container) return;

  container.innerHTML = "";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
  container.style.gap = "20px";
  container.style.padding = "20px";

  if (!movies || movies.length === 0) {
    container.innerHTML = "<p style='color: white; text-align: center; grid-column: 1/-1;'>Không tìm thấy bộ phim nào!</p>";
    return;
  }

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.style.cursor = "pointer";
    card.style.transition = "transform 0.2s";

    const imgUrl = getImageUrl(movie);

    card.innerHTML = `
      <img src="${imgUrl}" alt="${movie.name}" 
           onerror="this.onerror=null; this.src='https://via.placeholder.com/180x260?text=No+Image';"
           style="width: 100%; height: 260px; object-fit: cover; border-radius: 8px; background-color: #222;">
      <h4 style="color: white; font-size: 14px; margin: 8px 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${movie.name}">${movie.name}</h4>
      <p style="color: #aaa; font-size: 12px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${movie.origin_name || ''}">${movie.origin_name || ''}</p>
    `;

    card.onmouseover = () => card.style.transform = "scale(1.05)";
    card.onmouseout = () => card.style.transform = "scale(1)";
    card.onclick = () => handleWatchMovie(movie.slug);

    container.appendChild(card);
  });
}

function renderPlayerUI(movieData) {
  if (!movieData) return;
  const episodes = movieData.episodes?.[0]?.server_data;
  if (!episodes || episodes.length === 0) return;

  const embedUrl = episodes[0].link_embed;
  let playerContainer = document.getElementById("player-container");
  
  if (playerContainer) {
    playerContainer.style.display = "block";
    playerContainer.style.padding = "20px";
    playerContainer.style.background = "#111";
    
    playerContainer.innerHTML = `
      <h2 style="color: white; margin-bottom: 10px;">Đang phát: ${movieData.movie?.name || ''}</h2>
      <iframe src="${embedUrl}" style="width: 100%; height: 500px; border: none; border-radius: 8px;" allowfullscreen></iframe>
    `;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderPaginationUI(currentPage) {
  let paginationDiv = document.getElementById("pagination");
  if (!paginationDiv) {
    paginationDiv = document.createElement("div");
    paginationDiv.id = "pagination";
    paginationDiv.style.textAlign = "center";
    paginationDiv.style.padding = "20px";
    document.body.appendChild(paginationDiv);
  }

  paginationDiv.innerHTML = `
    <button id="btn-prev" ${currentPage <= 1 ? "disabled" : ""} style="padding: 10px 20px; margin-right: 10px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">Trang trước</button>
    <span style="color: white; font-weight: bold; margin: 0 10px;">Trang ${currentPage}</span>
    <button id="btn-next" style="padding: 10px 20px; margin-left: 10px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">Trang sau</button>
  `;

  document.getElementById("btn-prev").onclick = () => handlePageChange(currentPage - 1);
  document.getElementById("btn-next").onclick = () => handlePageChange(currentPage + 1);
}

// --- LUỒNG ĐIỀU KHIỂN (CONTROLLER) ---
window.loadData = async function(category = currentCategory, page = pageIndex) {
  currentCategory = category;
  pageIndex = page;
  currentKeyword = "";
  
  const playerContainer = document.getElementById("player-container");
  if (playerContainer) playerContainer.style.display = "none";

  const { items } = await fetchMovies(currentCategory, pageIndex);
  renderMoviesUI(items);
  renderPaginationUI(pageIndex);
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
        renderMoviesUI(results);
        const pag = document.getElementById("pagination");
        if (pag) pag.innerHTML = ""; 
      }
    });
  }
});