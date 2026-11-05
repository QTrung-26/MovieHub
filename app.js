const BASE_URL = "https://phimapi.com";

// 1. Lấy danh sách phim mới cập nhật từ KKPhim
async function getMovies() {
  try {
    const res = await fetch(`${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=1`);
    const data = await res.json();
    
    // Gọi hàm hiển thị danh sách phim ra màn hình
    renderMovies(data.items);
  } catch (error) {
    console.error("Lỗi tải danh sách phim:", error);
  }
}

// 2. Hàm vẽ danh sách phim ra giao diện HTML
function renderMovies(movies) {
  // Tìm container chứa phim trên trang (ưu tiên id="rows" hoặc thẻ main)
  const container = document.getElementById("rows") || document.querySelector("main");
  if (!container) return;

  container.innerHTML = ""; // Xóa nội dung cũ (nếu có)
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "20px";
  container.style.padding = "20px";
  container.style.justifyContent = "center";

  movies.forEach(movie => {
    // Xử lý đường dẫn ảnh poster từ KKPhim
    let imageUrl = movie.poster_url;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://img.phimapi.com/${imageUrl}`;
    }

    // Tạo thẻ chứa từng bộ phim
    const card = document.createElement("div");
    card.style.width = "180px";
    card.style.cursor = "pointer";
    card.style.transition = "transform 0.2s";
    
    card.innerHTML = `
      <img src="${imageUrl}" alt="${movie.name}" style="width: 100%; height: 260px; object-fit: cover; border-radius: 8px;">
      <h4 style="color: white; font-size: 14px; margin: 8px 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${movie.name}</h4>
      <p style="color: #aaa; font-size: 12px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${movie.origin_name}</p>
    `;

    // Hiệu ứng hover nhỏ khi di chuột vào poster
    card.onmouseover = () => card.style.transform = "scale(1.05)";
    card.onmouseout = () => card.style.transform = "scale(1)";

    // Khi bấm vào phim sẽ gọi hàm xem phim full
    card.onclick = () => {
      watchMovie(movie.slug);
    };

    container.appendChild(card);
  });
}

// 3. Lấy link xem phim FULL (link embed) theo slug khi người dùng bấm chọn phim
async function watchMovie(slug) {
  try {
    const res = await fetch(`${BASE_URL}/phim/${slug}`);
    const data = await res.json();
    
    const episodes = data.episodes[0]?.server_data;
    if (episodes && episodes.length > 0) {
      const embedUrl = episodes[0].link_embed;
      
      // Tạo hoặc tìm khung iframe để phát video
      let player = document.getElementById("movie-player");
      if (!player) {
        player = document.createElement("iframe");
        player.id = "movie-player";
        player.style.width = "100%";
        player.style.height = "500px";
        player.style.border = "none";
        player.style.marginBottom = "20px";
        
        // Chèn iframe lên đầu trang web để xem
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

// Tự động tải danh sách phim khi mở trang
document.addEventListener("DOMContentLoaded", getMovies);