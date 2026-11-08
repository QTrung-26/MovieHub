// Đăng nhập thật bằng Firebase Authentication: email + mật khẩu, Google, số điện thoại (SMS).
// Dùng chung cho index.html và login.html. Cấu hình nằm trong firebase-config.js.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  sendEmailVerification, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup,
  RecaptchaVerifier, signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const cfg = window.FIREBASE_CONFIG || {};
export const configured = Boolean(cfg.apiKey && cfg.projectId && !/DÁN|PASTE|YOUR/i.test(cfg.apiKey));

export let auth = null;
if (configured) {
  auth = getAuth(initializeApp(cfg));
  auth.languageCode = "vi";
}

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Phiên đăng nhập được lưu lại để app.js hiển thị ngay (tên, ảnh), còn xác thực thật do Firebase giữ
const nameOf = (u) => u.displayName || (u.email ? u.email.split("@")[0] : "Thành viên " + (u.phoneNumber || "").slice(-4));

function mergeGuestData(uid) { // gộp phim đã lưu / lịch sử khi chưa đăng nhập vào tài khoản
  for (const p of ["qt_fav_", "qt_hist_", "qt_remind_"]) {
    const guest = lsGet(p + "guest", []);
    if (!guest.length) continue;
    const cur = lsGet(p + uid, []), have = new Set(cur.map((m) => m.slug));
    lsSet(p + uid, [...cur, ...guest.filter((m) => !have.has(m.slug))]);
    localStorage.removeItem(p + "guest");
  }
}

export function syncSession(user) {
  if (user) {
    lsSet("qt_session", { id: user.uid, name: nameOf(user), email: user.email || user.phoneNumber || "", photo: user.photoURL || "" });
    mergeGuestData(user.uid);
  } else {
    localStorage.removeItem("qt_session");
  }
  window.dispatchEvent(new Event("qt-auth-change"));
}

if (auth) onAuthStateChanged(auth, syncSession);

// Chờ Firebase đọc xong trạng thái đăng nhập lần đầu
export const ready = auth
  ? new Promise((res) => { const off = onAuthStateChanged(auth, () => { off(); res(); }); })
  : Promise.resolve();

export const logout = () => (auth ? signOut(auth) : Promise.resolve());
window.QTAuth = { configured, signOut: logout };

// ----- Email + mật khẩu -----
export const loginEmail = async (email, pw) => (await signInWithEmailAndPassword(auth, email, pw)).user;

export async function registerEmail(name, email, pw) {
  const cred = await createUserWithEmailAndPassword(auth, email, pw);
  if (name) await updateProfile(cred.user, { displayName: name });
  sendEmailVerification(cred.user).catch(() => {}); // gửi email xác minh, không bắt buộc để xem phim
  return auth.currentUser;
}

export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

// ----- Google -----
export const loginGoogle = async () => (await signInWithPopup(auth, new GoogleAuthProvider())).user;

// ----- Số điện thoại (SMS) -----
let verifier = null, confirmation = null;

export async function sendPhoneCode(e164, containerId) {
  if (!verifier) verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  try {
    confirmation = await signInWithPhoneNumber(auth, e164, verifier);
  } catch (err) {
    try { verifier.clear(); } catch {}
    verifier = null;
    throw err;
  }
}

export async function confirmPhoneCode(code) {
  if (!confirmation) throw new Error("Hãy gửi mã xác nhận trước.");
  return (await confirmation.confirm(code)).user;
}

// ----- Thông báo lỗi tiếng Việt -----
const MSG = {
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
  "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
  "auth/user-not-found": "Email hoặc mật khẩu không đúng.",
  "auth/email-already-in-use": "Email này đã được đăng ký. Hãy chuyển sang Đăng nhập.",
  "auth/weak-password": "Mật khẩu quá yếu, cần ít nhất 6 ký tự.",
  "auth/invalid-email": "Email chưa đúng định dạng.",
  "auth/too-many-requests": "Bạn thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.",
  "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập Google.",
  "auth/cancelled-popup-request": "Bạn đã đóng cửa sổ đăng nhập Google.",
  "auth/popup-blocked": "Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép cửa sổ bật lên rồi thử lại.",
  "auth/unauthorized-domain": "Tên miền này chưa được cho phép. Thêm nó vào Authorized domains trong Firebase.",
  "auth/operation-not-allowed": "Cách đăng nhập này chưa được bật trong Firebase Console.",
  "auth/invalid-phone-number": "Số điện thoại chưa đúng.",
  "auth/missing-phone-number": "Vui lòng nhập số điện thoại.",
  "auth/invalid-verification-code": "Mã xác nhận không đúng.",
  "auth/code-expired": "Mã đã hết hạn, hãy gửi lại mã mới.",
  "auth/quota-exceeded": "Đã vượt hạn mức gửi SMS. Vui lòng thử lại sau.",
  "auth/billing-not-enabled": "Gửi SMS cần bật gói Blaze (trả theo mức dùng) trong Firebase.",
  "auth/captcha-check-failed": "Không xác minh được reCAPTCHA. Tải lại trang rồi thử lại.",
  "auth/network-request-failed": "Lỗi mạng. Hãy kiểm tra kết nối rồi thử lại."
};
export const friendlyError = (e) => MSG[e?.code] || (e?.code ? "Lỗi: " + e.code : e?.message) || "Đã có lỗi xảy ra, vui lòng thử lại.";