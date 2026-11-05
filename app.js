const BASE_URL = "https://phimapi.com";
let currentPage = 1;

// 1. Lấy danh sách phim theo số trang (Dùng để làm nút chuyển trang)
async function getMovies(page = 1) {
  try {
    const res = await fetch(`${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`);
    const data = await res.json();
    
    if (data.items) {
      renderMovies(data.items);
      renderPagination(data.pagination); // Tạo nút chuyển trang
    }
  } catch (error) {
    console.error("Lỗi tải danh sách phim:", error);
  }
}

// 2. Hàm vẽ danh sách phim dạng lưới
function renderMovies(movies) {
  const container = document.getElementById("rows") || document.querySelector("main");
  if (!container) return;

  container.innerHTML = "";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
  container.style.gap = "20px";
  container.style.padding = "20px";

  movies.forEach(movie => {
    let imageUrl = movie.poster_url;
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

// 3. Tạo thanh phân trang (Trang trước / Trang sau)
function renderPagination(pagination) {
  let paginationDiv = document.getElementById("pagination");
  if (!paginationDiv) {
    paginationDiv = document.createElement("div");
    paginationDiv.id = "pagination";
    paginationDiv.style.textAlign = "center";
    paginationDiv.style.padding = "20px";
    document.body.appendChild(paginationDiv);
  }

  paginationDiv.innerHTML = `
    <button onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} style="padding: 10px 20px; margin-right: 10px; cursor: pointer;">Trang trước</button>
    <span style="color: white; font-weight: bold; margin: 0 10px;">Trang ${currentPage}</span>
    <button onclick="changePage(${currentPage + 1})" style="padding: 10px 20px; margin-left: 10px; cursor: pointer;">Trang sau</button>
  `;
}

// Đổi trang
window.changePage = function(page) {
  if (page < 1) return;
  currentPage = page;
  getMovies(currentPage);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 4. Lấy link xem phim FULL theo slug
async function watchMovie(slug) {
  try {
    const res = await fetch(`${BASE_URL}/phim/${slug}`);
    const data = await res.json();
    
    const episodes = data.episodes[0]?.server_data;
    if (episodes && episodes.length > 0) {
      const embedUrl = episodes[0].link_embed;
      
      let player = document.getElementById("movie-player");
      if (!player) {
        player = document.createElement("iframe");
        player.id = "movie-player";
        player.style.width = "100%";
        player.style.height = "500px";
        player.style.border = "none";
        player.style.marginBottom = "20px";
        
        const main = document.querySelector("main") || document.body;
        main.prepend(player);
      }
      player.src = embedUrl;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (error) {
    console.error("Lỗi lấy thông tin phim:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => getMovies(currentPage));