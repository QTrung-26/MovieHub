const BASE_URL = "https://phimapi.com";

// Tải danh sách phim theo danh mục / thể loại
async function fetchMovies(type = "phim-moi-cap-nhat", page = 1) {
  try {
    let url = `${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`;
    if (["phim-le", "phim-bo", "hoat-hinh", "tv-shows"].includes(type)) {
      url = `${BASE_URL}/v1/api/danh-sach/${type}?page=${page}`;
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

// Tìm kiếm phim theo từ khóa
async function searchMoviesAPI(keyword) {
  if (!keyword.trim()) return [];
  try {
    const res = await fetch(`${BASE_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=24`);
    const data = await res.json();
    
    // API KKPhim v1 trả về domain_cdn_image để ghép link ảnh chính xác
    const domainCdn = data.data?.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";
    const items = (data.data?.items || []).map(item => {
      let poster = item.poster_url || item.thumb_url;
      if (poster && !poster.startsWith('http')) {
        poster = `${domainCdn}/${poster}`;
      }
      return { ...item, poster_url: poster };
    });
    return items;
  } catch (err) {
    console.error("Lỗi gọi API search:", err);
    return [];
  }
}

// Lấy thông tin chi tiết phim & link embed
async function fetchMovieDetail(slug) {
  try {
    const res = await fetch(`${BASE_URL}/phim/${slug}`);
    return await res.json();
  } catch (err) {
    console.error("Lỗi lấy chi tiết phim:", err);
    return null;
  }
}