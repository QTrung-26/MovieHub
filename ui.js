// Xử lý link ảnh poster chuẩn cho mọi nguồn từ KKPhim
function getImageUrl(movie) {
  let img = movie.poster_url || movie.thumb_url || "";
  if (!img) return "https://via.placeholder.com/180x260?text=No+Image";
  if (img.startsWith("http")) return img;
  return `https://img.phimapi.com/${img}`;
}

// Render danh sách phim ra màn hình
function renderMoviesUI(movies, onCardClick) {
  const container = document.getElementById("rows") || document.querySelector("main");
  if (!container) return;

  container.innerHTML = "";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
  container.style.gap = "20px";
  container.style.padding = "20px";

  if (!movies || movies.length === 0) {
    container.innerHTML = "<p style='color: white; text-align: center; grid-column: 1/-1;'>Không tìm thấy phim nào!</p>";
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
    card.onclick = () => onCardClick(movie.slug);

    container.appendChild(card);
  });
}

// Render iframe trình phát phim
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

// Render thanh phân trang
function renderPaginationUI(currentPage, onPageChange) {
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

  document.getElementById("btn-prev").onclick = () => onPageChange(currentPage - 1);
  document.getElementById("btn-next").onclick = () => onPageChange(currentPage + 1);
}