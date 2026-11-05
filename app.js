const API_KEY = 'f4a0810610d5b6680115809d226b4286';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const $ = (s) => document.querySelector(s);
const esc = (s = '') => {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML.replace(/"/g, '&quot;');
};
const getFavs = () => JSON.parse(localStorage.getItem('favs') || '[]');
const setFavs = (a) => localStorage.setItem('favs', JSON.stringify(a));

// Gọi API TMDB
async function api(path, params = {}) {
  const q = new URLSearchParams({ api_key: API_KEY, language: 'vi-VN', ...params });
  const res = await fetch(`${BASE}${path}?${q}`);
  if (!res.ok) throw new Error('Lỗi API ' + res.status);
  return res.json();
}

// Thẻ phim
function card(m) {
  if (!m.poster_path) return '';
  return `<div class='card' data-id='${m.id}'>
    <img loading='lazy' src='${IMG}/w342${m.poster_path}' alt='${esc(m.title)}'>
    <p>${esc(m.title)}</p></div>`;
}

// Banner lớn
async function loadHero() {
  const m = (await api('/trending/movie/day')).results[0];
  $('#hero').style.backgroundImage =
    `linear-gradient(to top,#0b0d12 5%,transparent 60%),url(${IMG}/w1280${m.backdrop_path})`;
  $('#hero').innerHTML = `<div class='hero-text'><h2>${esc(m.title)}</h2>
    <p>${esc(m.overview).slice(0, 200)}...</p>
    <button data-id='${m.id}'>▶ Chi tiết và trailer</button></div>`;
}

// Các hàng phim
const ROWS = [
  ['Đang thịnh hành', '/trending/movie/week'],
  ['Đang chiếu', '/movie/now_playing'],
  ['Được đánh giá cao', '/movie/top_rated'],
  ['Sắp ra mắt', '/movie/upcoming'],
];
async function loadRows() {
  for (const [title, path] of ROWS) {
    const data = await api(path);
    $('#rows').insertAdjacentHTML('beforeend',
      `<section><h3>${title}</h3><div class='row'>${data.results.map(card).join('')}</div></section>`);
  }
}

// Trang chi tiết + trailer + yêu thích
async function openDetail(id) {
  const m = await api(`/movie/${id}`, { append_to_response: 'videos,credits', include_video_language: 'vi,en,null' });
  const t = m.videos.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const cast = m.credits.cast.slice(0, 6).map((c) => esc(c.name)).join(', ');
  $('#modal-content').innerHTML = `
    <h2>${esc(m.title)} <small>(${(m.release_date || '').slice(0, 4)})</small></h2>
    <p>⭐ ${m.vote_average.toFixed(1)} · ${m.runtime || '?'} phút · ${m.genres.map((g) => esc(g.name)).join(', ')}</p>
    ${t ? `<iframe src='https://www.youtube.com/embed/${t.key}' allowfullscreen></iframe>` : '<p><i>Chưa có trailer.</i></p>'}
    <p>${esc(m.overview) || 'Chưa có mô tả.'}</p>
    <p><b>Diễn viên:</b> ${cast}</p>
    <button id='favToggle'></button>`;
  const btn = $('#favToggle');
  const paint = () => (btn.textContent = getFavs().some((f) => f.id === m.id) ? '💔 Bỏ yêu thích' : '❤ Thêm yêu thích');
  paint();
  btn.onclick = () => {
    const favs = getFavs();
    const i = favs.findIndex((f) => f.id === m.id);
    if (i >= 0) favs.splice(i, 1); else favs.push({ id: m.id, title: m.title, poster_path: m.poster_path });
    setFavs(favs);
    paint();
  };
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal-content').innerHTML = ''; // dừng video
}

// Chuyển giữa trang chủ và lưới kết quả
function showGrid(list, emptyMsg) {
  $('#results').innerHTML = list.map(card).join('') || `<p>${emptyMsg}</p>`;
  $('#results').classList.remove('hidden');
  $('#rows').classList.add('hidden');
  $('#hero').classList.add('hidden');
}
function showHome() {
  $('#results').classList.add('hidden');
  $('#rows').classList.remove('hidden');
  $('#hero').classList.remove('hidden');
}

// Sự kiện
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-id]');
  if (el) openDetail(el.dataset.id).catch((err) => alert(err.message));
});
$('#close').onclick = closeModal;
$('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
$('#favBtn').onclick = () => showGrid(getFavs(), 'Bạn chưa lưu phim nào.');

let timer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(timer);
  const q = e.target.value.trim();
  timer = setTimeout(async () => {
    if (!q) return showHome();
    const d = await api('/search/movie', { query: q });
    showGrid(d.results, 'Không tìm thấy phim nào.');
  }, 400); // đợi 0,4 giây sau khi ngừng gõ mới tìm
});

// Khởi động
(async function init() {
  try {
    await loadHero();
    await loadRows();
  } catch (err) {
    $('#rows').innerHTML = `<p>Không tải được dữ liệu: ${err.message}</p>`;
  }
})();