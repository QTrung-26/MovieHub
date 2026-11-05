const BASE_URL = "https://phimapi.com";
let currentType = "phim-moi-cap-nhat"; // Mặc định là phim mới
let currentPage = 1;
let currentKeyword = "";

// 1. Tải danh sách phim theo thể loại/danh mục hoặc phân trang
async function loadMovies(type = currentType, page = 1) {
  currentType = type;
  currentPage = page;
  currentKeyword = "";
  
  try {
    let url = `${BASE_URL}/danh-sach/${type}?page=${page}`;
    // Nếu là các danh mục đặc biệt của KKPhim
    if (type === "phim-le" || type === "phim-bo" || type === "hoat-hinh" || type === "tv-show") {
      url = `${BASE_URL}/vapi/v1/danh-sach/${type}?page=${page}`; // Hoặc endpoint tương ứng
    }
    
    // Dùng chung endpoint phim-moi-cap-nhat nhưng phân loại theo từ khóa hoặc gọi API theo v1 vapi nếu cần
    // Để đơn giản và mượt với KKPhim, ta dùng các v1 path chuẩn:
    // /v1/api/danh-sach/phim-le, phim-bo, hoat-hinh, tv-shows
    if (["phim-le", "phim-bo", "hoat-hinh", "tv-shows"].includes(type)) {
      url = `${BASE_URL}/v1/api/danh-sach/${type}?page=${page}`;
    } else {
      url = `${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    
    // Lấy items và pagination tùy theo cấu trúc trả về của KKPhim v1 hoặc v2
    const items = data.data?.items || data.items || [];
    const pagination = data.data?.params?.pagination || data.pagination;

    renderMovies(items);
    renderPagination(pagination);
  } catch (error) {
    console.error("Lỗi tải phim:", error);
  }
}

// 2. Tính năng Tìm kiếm phim theo tên
async function searchMovies(keyword) {
  if (!keyword.trim()) return;
  currentKeyword = keyword;
  try {
    const res = await fetch(`${BASE_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=24`);
    const data = await res.json();
    
    const items = data.data?.items || [];
    renderMovies(items);
    
    // Xóa phân trang khi đang tìm kiếm
    const paginationDiv = document.getElementById("pagination");
    if (paginationDiv) paginationDiv.innerHTML = "";
  } catch (error) {
    console.error("Lỗi tìm kiếm phim:", error);
  }
}

// 3. Hàm vẽ danh sách phim dạng lưới (Grid)
function renderMovies(movies) {
  const container = document.getElementById("rows") || document.querySelector("main");
  if (!container) return;

  container.innerHTML = "";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
  container.style.gap = "20px";
  container.style.padding = "20px";

  if (movies.length === 0) {
    container.innerHTML = "<p style='color: white; text-align: center; grid-column: 1/-1;'>Không tìm thấy bộ phim nào phù hợp!</p>";
    return;
  }

  movies.forEach(movie => {
    // Xử lý link ảnh poster (KKPhim trả về có thể là đường dẫn tương đối hoặc tuyệt đối)
    let imageUrl = movie.poster_url || movie.thumb_url;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://img.phimapi.com/${imageUrl}`;
    }

    const card = document.createElement("div");
    card.style.cursor = "pointer";
    card.style.transition = "transform 0.2s";
    
    card.innerHTML = `
      <img src="${imageUrl}" alt="${movie.name}" style="width: 100%; height: 260px; object-fit: cover; border-radius: 8px;">
      <h4 style="color: white; font-size: 14px; margin: 8px 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${movie.name}">${movie.name}</h4>
      <p style="color: #aaa; font-size: 12px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${movie.origin_name}">${movie.origin_name}</p>
    `;

    card.onmouseover = () => card.style.transform = "scale(1.05)";
    card.onmouseout = () => card.style.transform = "scale(1)";

    card.onclick = () => {
      watchMovie(movie.slug);
    };

    container.appendChild(card);
  });
}

// 4. Tạo thanh phân trang
function renderPagination(pagination) {
  let paginationDiv = document.getElementById("pagination");
  if (!paginationDiv) {
    paginationDiv = document.createElement("div");
    paginationDiv.id = "pagination";
    paginationDiv.style.textAlign = "center";
    paginationDiv.style.padding = "20px";
    document.body.appendChild(paginationDiv);
  }

  // Nếu API trả về tổng trang
  const totalPages = pagination?.totalPages || 100;
  
  paginationDiv.innerHTML = `
    <button onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} style="padding: 10px 20px; margin-right: 10px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">Trang trước</button>
    <span style="color: white; font-weight: bold; margin: 0 10px;">Trang ${currentPage}</span>
    <button onclick="changePage(${currentPage + 1})" style="padding: 10px 20px; margin-left: 10px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">Trang sau</button>
  `;
}

window.changePage = function(page) {
  if (page < 1) return;
  currentPage = page;
  if (currentKeyword) {
    searchMovies(currentKeyword);
  } else {
    loadMovies(currentType, currentPage);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 5. Xem phim full (Embed Player)
async function watchMovie(slug) {
  try {
    const res = await fetch(`${BASE_URL}/phim/${slug}`);
    const data = await res.json();
    
    const movieInfo = data.movie;
    const episodes = data.episodes[0]?.server_data;
    
    if (episodes && episodes.length > 0) {
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
        <h2 style="color: white; margin-bottom: 10px;">Đang phát: ${movieInfo?.name || ''}</h2>
        <iframe id="movie-player" src="${embedUrl}" style="width: 100%; height: 500px; border: none; border-radius: 8px;" allowfullscreen></iframe>
      `;
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (error) {
    console.error("Lỗi phát phim:", error);
  }
}

// 6. Gắn sự kiện cho ô tìm kiếm và các nút thể loại khi trang được tải
document.addEventListener("DOMContentLoaded", () => {
  // Tải mặc định phim mới
  loadMovies("phim-moi-cap-nhat", 1);

  // Xử lý ô input tìm kiếm (Nhấn Enter hoặc gõ)
  const searchInput = document.querySelector("input[type='text']") || document.querySelector("input");
  if (searchInput) {
    searchInput.placeholder = "Nhập tên phim cần tìm...";
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        searchMovies(searchInput.value);
      }
    });
  }

  // Thêm menu chọn thể loại lên đầu trang nếu chưa có
  let navMenu = document.getElementById("category-menu");
  if (!navMenu) {
    navMenu = document.createElement("div");
    navMenu.id = "category-menu";
    navMenu.style.display = "flex";
    navMenu.style.justifyContent = "center";
    navMenu.style.gap = "15px";
    navMenu.style.padding = "15px";
    navMenu.style.background = "#1a1a1a";
    
    navMenu.innerHTML = `
      <button onclick="loadMovies('phim-moi-cap-nhat', 1)" style="padding: 8px 16px; cursor: pointer; background: #e50914; color: white; border: none; border-radius: 4px;">Mới cập nhật</button>
      <button onclick="loadMovies('phim-le', 1)" style="padding: 8px 16px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">Phim Lẻ</button>
      <button onclick="loadMovies('phim-bo', 1)" style="padding: 8px 16px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">Phim Bộ</button>
      <button onclick="loadMovies('hoat-hinh', 1)" style="padding: 8px 16px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">Hoạt Hình</button>
      <button onclick="loadMovies('tv-shows', 1)" style="padding: 8px 16px; cursor: pointer; background: #333; color: white; border: none; border-radius: 4px;">TV Shows</button>
    `;
    
    const header = document.querySelector("header") || document.body;
    header.after(navMenu);
  }
});