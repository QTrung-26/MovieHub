let currentCategory = "phim-moi-cap-nhat";
let pageIndex = 1;

async function loadData() {
  const { items } = await fetchMovies(currentCategory, pageIndex);
  renderMoviesUI(items, handleWatchMovie);
  renderPaginationUI(pageIndex, handlePageChange);
}

async function handleWatchMovie(slug) {
  const movieData = await fetchMovieDetail(slug);
  renderPlayerUI(movieData);
}

function handlePageChange(newPage) {
  if (newPage < 1) return;
  pageIndex = newPage;
  loadData();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Khởi tạo ứng dụng
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // Xử lý ô tìm kiếm tên phim
  const searchInput = document.querySelector("input[type='text']") || document.querySelector("input");
  if (searchInput) {
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        const results = await searchMoviesAPI(searchInput.value);
        renderMoviesUI(results, handleWatchMovie);
        const pag = document.getElementById("pagination");
        if (pag) pag.innerHTML = "";
      }
    });
  }
});