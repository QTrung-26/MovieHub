const BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SECRET_URL) ? CONFIG.SECRET_URL : "https://phimapi.com";
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
    const domainCdn = data.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";
    return (data.data?.items || []).map(item => {
      let poster = item.poster_url || item.thumb_url;
      if (poster && !poster.startsWith('http')) {
        poster = `${domainCdn}/${poster}`;
      }
      return { ...item, poster_url: poster };
    });
  } catch (err) {
    console.error("Lỗi tìm kiếm:", err);
    return [];
  }
}

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
  if (img.startsWith("http")) return img;
  return `https://img.phimapi.com/${img}`;
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
           onerror="this.onerror=null; this.src='https://via.placeholder.com/180x260?text=Error';"
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
  
  if (!playerContainer) {
    playerContainer = document.createElement("div");
    playerContainer.id = "player-container";
    playerContainer.style.padding = "20px";
    playerContainer.style.background = "#111";
    
    const main = document.querySelector("main") || document.body;
    main.prepend(playerContainer);
  }

  playerContainer.innerHTML = `
    <h2 style="color: white; margin-bottom: 10px;">Đang phát: ${movieData.movie?.name || ''}</h2>
    <iframe src="${embedUrl}" style="width: 100%; height: 500px; border: none; border-radius: 8px;" allowfullscreen></iframe>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Xử lý sự kiện tìm kiếm khi nhấn Enter trên ô input
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
        if (pag) pag.innerHTML = ""; // Ẩn phân trang khi đang xem kết quả tìm kiếm
      }
    });
  }
});