let currentCategory = "phim-moi-cap-nhat";
let pageIndex = 1;

// Gắn hàm vào window để các nút bấm trong HTML gọi được trực tiếp
window.loadData = async function(category = currentCategory, page = pageIndex) {
  currentCategory = category;
  pageIndex = page;
  try {
    const data = await fetchMovies(currentCategory, pageIndex);
    if (data && data.items) {
      renderMoviesUI(data.items, handleWatchMovie);
      renderPaginationUI(pageIndex, handlePageChange);
    }
  } catch (error) {
    console.error("Lỗi tải dữ liệu phim:", error);
  }
};

async function handleWatchMovie(slug) {
  try {
    const movieData = await fetchMovieDetail(slug);
    renderPlayerUI(movieData);
  } catch (error) {
    console.error("Lỗi xem phim:", error);
  }
}

function handlePageChange(newPage) {
  if (newPage < 1) return;
  pageIndex = newPage;
  window.loadData(currentCategory, pageIndex);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Khởi chạy khi trang web tải xong
document.addEventListener("DOMContentLoaded", () => {
  window.loadData("phim-moi-cap-nhat", 1);

  // Xử lý ô tìm kiếm
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        const keyword = searchInput.value;
        if (!keyword.trim()) return;
        try {
          const results = await searchMoviesAPI(keyword);
          renderMoviesUI(results, handleWatchMovie);
          const pag = document.getElementById("pagination");
          if (pag) pag.innerHTML = ""; // Ẩn phân trang khi đang tìm kiếm
        } catch (err) {
          console.error("Lỗi tìm kiếm:", err);
        }
      }
    });
  }
});