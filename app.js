const BASE_URL = "https://phimapi.com";

// 1. Lấy danh sách phim mới cập nhật từ KKPhim
async function getMovies() {
  try {
    const res = await fetch(`${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=1`);
    const data = await res.json();
    
    // data.items chứa mảng danh sách phim
    renderMovies(data.items);
  } catch (error) {
    console.error("Lỗi lấy danh sách phim:", error);
  }
}

// 2. Lấy link xem phim FULL (link embed) theo slug của phim
async function watchMovie(slug) {
  try {
    const res = await fetch(`${BASE_URL}/phim/${slug}`);
    const data = await res.json();
    
    // Lấy link nhúng (embed) phát phim full ở tập 1
    const episodes = data.episodes[0]?.server_data;
    if (episodes && episodes.length > 0) {
      const embedUrl = episodes[0].link_embed;
      
      // Gán link embed vào thẻ iframe phát video trên trang web
      const player = document.getElementById("movie-player"); // Đổi ID này cho khớp với thẻ iframe trong file index.html của bạn
      if (player) {
        player.src = embedUrl;
      }
    }
  } catch (error) {
    console.error("Lỗi lấy thông tin phim:", error);
  }
}

// Tự động gọi hàm lấy danh sách phim khi trang web tải xong
document.addEventListener("DOMContentLoaded", getMovies);