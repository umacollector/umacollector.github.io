// UmaUma hesap sistemi (Firebase). Kullanıcı adı + şifre; kullanıcı adları arka planda iç bir
// e-posta adresine çevrilir (kullaniciadi@<proje>.firebaseapp.com), şifreleri Firebase hash'leyerek saklar.
// Aynı kullanıcı adı ikinci kez alınamaz, çünkü aynı iç adres ikinci kez açılamaz.
//
// Veri (kurallar: Site/firestore-kurallari.txt):
//   profiles/{uid}    herkese açık: { username, usernameLower, avatar, banner, team, stats, createdAt, updatedAt }
//                     avatar: Uma kart id'si · banner: { kind: "uma" | "card", id } · team: sadeleştirilmiş takım
//   inventories/{uid} yalnızca sahibi: { umas, cards, team } (Uma Collector dosyalarından yüklenenler)
//
// app.js ile iletişim: window.UmaAuth (fonksiyonlar) ve "umauth" olayı (giriş durumu değişince).

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const cfg = window.UMAUMA_FIREBASE || {};
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;
const MIN_PASSWORD = 8;

const state = { user: null, profile: null };
const emit = () => window.dispatchEvent(new CustomEvent("umauth", { detail: { ...state } }));

function errorText(e) {
  const c = (e && e.code) || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Kullanıcı adı ya da şifre yanlış.";
  if (c.includes("email-already-in-use")) return "Bu kullanıcı adı alınmış, başka bir tane dene.";
  if (c.includes("weak-password")) return `Şifre en az ${MIN_PASSWORD} karakter olmalı.`;
  if (c.includes("too-many-requests")) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
  if (c.includes("network")) return "Bağlantı kurulamadı. İnternetini kontrol et.";
  if (c.includes("permission")) return "Bu işlem için izin yok.";
  return "Bir sorun oldu, tekrar dene.";
}

if (!cfg.apiKey || !cfg.appId) {
  window.UmaAuth = { ready: false };
  emit();
} else {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const EMAIL_DOMAIN = cfg.authDomain;
  const toEmail = (name) => `${name.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

  async function loadProfile(uid) {
    const snap = await getDoc(doc(db, "profiles", uid));
    return snap.exists() ? snap.data() : null;
  }

  window.UmaAuth = {
    ready: true,
    get user() { return state.user; },
    get profile() { return state.profile; },
    MIN_PASSWORD,

    async login(username, password) {
      const name = (username || "").trim();
      if (!USERNAME_RE.test(name)) throw new Error("Kullanıcı adı ya da şifre yanlış.");
      try {
        await signInWithEmailAndPassword(auth, toEmail(name), password);
      } catch (e) { throw new Error(errorText(e)); }
    },

    async register(username, password) {
      const name = (username || "").trim();
      if (!USERNAME_RE.test(name)) throw new Error("Kullanıcı adı 3-20 karakter olmalı; harf, rakam, nokta, alt çizgi ve tire kullanabilirsin.");
      if ((password || "").length < MIN_PASSWORD) throw new Error(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, toEmail(name), password);
      } catch (e) { throw new Error(errorText(e)); }
      const profile = { username: name, usernameLower: name.toLowerCase(), avatar: null, banner: null, team: [], stats: {},
                        createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      await setDoc(doc(db, "profiles", cred.user.uid), profile);
      state.profile = { ...profile };
      emit();
    },

    async logout() { await signOut(auth); },

    async saveProfile(patch) {
      if (!state.user) return;
      await setDoc(doc(db, "profiles", state.user.uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
      state.profile = { ...(state.profile || {}), ...patch };
      emit();
    },

    async loadInventory() {
      if (!state.user) return null;
      const snap = await getDoc(doc(db, "inventories", state.user.uid));
      return snap.exists() ? snap.data() : null;
    },

    async saveInventory(section, value) {
      if (!state.user) return;
      await setDoc(doc(db, "inventories", state.user.uid), { [section]: value }, { merge: true });
    },

    loadProfile,
  };

  onAuthStateChanged(auth, async (user) => {
    state.user = user ? { uid: user.uid } : null;
    state.profile = null;
    if (user) {
      try { state.profile = await loadProfile(user.uid); } catch (e) { state.profile = null; }
      // Kayıt sırasında profil henüz yazılmamış olabilir: kullanıcı adını e-postadan al
      if (!state.profile) state.profile = { username: (user.email || "").split("@")[0], avatar: null, banner: null, team: [] };
    }
    emit();
  });
}
