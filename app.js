function normalizePublicImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.hostname === "drive.google.com" || u.hostname === "docs.google.com") {
      let id = u.searchParams.get("id");
      if (!id) { const m = u.pathname.match(/\/file\/d\/([^/]+)/); if (m) id = m[1]; }
      if (id) return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w1600";
    }
  } catch (_) {}
  return raw;
}

function bindImageFallbacks(root = document) {
  root.querySelectorAll("img").forEach(img => {
    if (img.dataset.fallbackBound) return;
    img.dataset.fallbackBound = "1";
    img.addEventListener("error", () => {
      if (img.dataset.fallbackTried) { img.style.display = "none"; return; }
      img.dataset.fallbackTried = "1";
      const src = img.getAttribute("src") || "";
      const m = src.match(/[?&]id=([^&]+)/) || src.match(/\/d\/([^/?]+)/);
      if (m) img.src = "https://drive.google.com/uc?export=view&id=" + decodeURIComponent(m[1]);
      else img.style.display = "none";
    }, { once: true });
  });
}
/**
 * EventNev — app.js
 * Main application script for Network Evolution portal
 */

"use strict";

/* =========================================================
   CONFIG — GANTI URL INI DENGAN GOOGLE APPS SCRIPT ANDA
   ========================================================= */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgaSasJsN-J20DjJdKJ_0QHsA_8u_r9nqln6ZFFSrcPdljrMzZLkleEfqExnJvNMty/exec";

/* =========================================================
   STATE
   ========================================================= */
const state = {
  user: null,
  events: [],
  applications: [],
  trainers: [],
  activeFilter: "Semua",
};

/* =========================================================
   UTILITY
   ========================================================= */
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric"
    });
  } catch { return dateStr; }
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric", month: "short"
    });
  } catch { return dateStr; }
}

function sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let nevLoadingCount = 0;
let nevLoadingTimer = null;
function setNevLoading(active, message) {
  nevLoadingCount = Math.max(0, nevLoadingCount + (active ? 1 : -1));
  let el = document.getElementById("nevGlobalLoading");
  if (!el && active) {
    el = document.createElement("div");
    el.id = "nevGlobalLoading";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = '<span class="nev-loading-spinner"></span><span class="nev-loading-message"></span>';
    el.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;gap:12px;background:rgba(8,8,11,.48);backdrop-filter:blur(2px);color:#fff;font:600 14px system-ui,sans-serif";
    const style = document.createElement("style");
    style.textContent = "#nevGlobalLoading .nev-loading-spinner{width:25px;height:25px;border:3px solid rgba(255,255,255,.25);border-top-color:#ed2632;border-radius:50%;animation:nevSpin .7s linear infinite}#nevGlobalLoading .nev-loading-message{background:#19191f;border:1px solid #383840;border-radius:10px;padding:13px 16px;box-shadow:0 8px 28px #0005}@keyframes nevSpin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
    document.body.appendChild(el);
  }
  if (el) {
    if (active) el.querySelector(".nev-loading-message").textContent = message || "Memproses permintaan…";
    if (nevLoadingCount === 0) el.remove();
  }
}
async function apiFetch(params) {
  setNevLoading(true, "Memproses permintaan…");
  try {
    const url = new URL(SCRIPT_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Network error: " + res.status);
    return await res.json();
  } finally {
    setNevLoading(false);
  }
}

/* =========================================================
   AUTH
   ========================================================= */
function loadUser() {
  try {
    const raw = localStorage.getItem("nevUser");
    state.user = raw ? JSON.parse(raw) : null;
  } catch {
    state.user = null;
  }
}

function saveUser(user) {
  state.user = user;
  localStorage.setItem("nevUser", JSON.stringify(user));
}

function clearUser() {
  state.user = null;
  localStorage.removeItem("nevUser");
}

function updateAuthUI() {
  const authNav = document.getElementById("authNav");
  const dashboardNav = document.getElementById("dashboardNav");
  const profileBtn = document.getElementById("profileBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const pendaftaranSection = document.getElementById("pendaftaran");
  const scanAbsenBtn = document.getElementById("scanAbsenBtn");

  const isLoggedIn = !!state.user;

  if (authNav) authNav.hidden = isLoggedIn;
  if (dashboardNav) dashboardNav.hidden = !isLoggedIn;
  if (profileBtn) profileBtn.hidden = !isLoggedIn;
  if (logoutBtn) logoutBtn.hidden = !isLoggedIn;
  if (pendaftaranSection) pendaftaranSection.hidden = !isLoggedIn;
  if (scanAbsenBtn) scanAbsenBtn.hidden = !isLoggedIn;

  if (profileBtn && state.user) {
    profileBtn.textContent = state.user.nama || "Profil";
  }
}

function logout() {
  clearUser();
  updateAuthUI();
  renderMyApplications();
  toast("Kamu telah keluar.", "info");
}

/* =========================================================
   EVENTS
   ========================================================= */
function categoryBadge(cat) {
  if (!cat) return "";
  const map = {
    "Open Lab": "badge-openlab",
    "Bootcamp": "badge-bootcamp",
    "Open Recruitment": "badge-recruitment",
  };
  const cls = map[cat] || "badge-openlab";
  return `<span class="event-badge ${cls}">${sanitize(cat)}</span>`;
}

function statusBadge(status) {
  const isOpen = /buka|open/i.test(status || "");
  const cls = isOpen ? "badge-open" : "badge-closed";
  const label = isOpen ? "Pendaftaran Buka" : "Pendaftaran Tutup";
  return `<span class="event-badge ${cls}">${label}</span>`;
}

function buildEventCard(ev) {
  const imgHtml = ev.gambar
    ? `<img src="${sanitize(normalizePublicImageUrl(ev.gambar))}" alt="${sanitize(ev.nama)}" loading="lazy">`
    : `<span>📋</span>`;

  return `
    <article class="event-card" role="listitem" tabindex="0"
             data-id="${sanitize(ev.id || ev.nama)}"
             aria-label="${sanitize(ev.nama)}">
      <div class="event-card-img">${imgHtml}</div>
      <div class="event-card-body">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${categoryBadge(ev.kategori)}
          ${statusBadge(ev.status)}
        </div>
        <h3>${sanitize(ev.nama)}</h3>
        <p>${sanitize(ev.deskripsi || "")}</p>
        <div class="event-meta">
          ${ev.tanggal ? `<div class="event-meta-row"><span class="icon">📅</span>${formatDate(ev.tanggal)}</div>` : ""}
          ${ev.lokasi ? `<div class="event-meta-row"><span class="icon">📍</span>${sanitize(ev.lokasi)}</div>` : ""}
          ${ev.waktu ? `<div class="event-meta-row"><span class="icon">🕐</span>${sanitize(ev.waktu)}</div>` : ""}
        </div>
      </div>
      <div class="event-card-footer">
        <span class="event-quota">${ev.kuota ? `Kuota: ${sanitize(String(ev.kuota))}` : ""}</span>
        <span class="btn btn-outline" style="font-size:.78rem;padding:8px 14px;">Detail →</span>
      </div>
    </article>`;
}

function renderEvents(list) {
  const grid = document.getElementById("eventGrid");
  if (!grid) return;

  const filtered = state.activeFilter === "Semua"
    ? list
    : list.filter(e => e.kategori === state.activeFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">Belum ada kegiatan ${state.activeFilter === "Semua" ? "" : state.activeFilter} yang tersedia.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(buildEventCard).join("");

  // Click handler
  grid.querySelectorAll(".event-card").forEach(card => {
    const open = () => {
      const id = card.dataset.id;
      const ev = state.events.find(e => (e.id || e.nama) == id);
      if (ev) openEventModal(ev);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}

async function fetchEvents() {
  const grid = document.getElementById("eventGrid");
  if (grid) grid.innerHTML = buildSkeletons(6);
  try {
    const data = await apiFetch({ action: "getEvents" });
    state.events = Array.isArray(data) ? data : (data.events || []);
    renderEvents(state.events);
    updateImpactStats();
  } catch (err) {
    console.error("fetchEvents:", err);
    if (grid) grid.innerHTML = `<div class="empty-state">Gagal memuat kegiatan. Coba lagi nanti.</div>`;
    // Demo data jika API belum dikonfigurasi
    loadDemoEvents();
  }
}

function buildSkeletons(n) {
  return Array.from({ length: n }, () =>
    `<div class="event-card">
      <div class="event-card-img skeleton"></div>
      <div class="event-card-body">
        <div class="skeleton" style="height:22px;width:40%;border-radius:100px;"></div>
        <div class="skeleton" style="height:20px;width:80%;margin-top:8px;"></div>
        <div class="skeleton" style="height:14px;width:90%;margin-top:6px;"></div>
      </div>
     </div>`
  ).join("");
}

function loadDemoEvents() {
  state.events = [
    {
      id: 1, nama: "Open Lab: Jaringan Komputer Dasar", kategori: "Open Lab",
      deskripsi: "Kenali dasar-dasar jaringan komputer, konfigurasi router dan switch, serta praktik langsung dengan perangkat nyata.",
      tanggal: "2026-11-10", lokasi: "Lab Jaringan NEV", waktu: "09.00 – 13.00 WIB",
      status: "Buka", kuota: 30
    },
    {
      id: 2, nama: "Bootcamp: Web Development Full Stack", kategori: "Bootcamp",
      deskripsi: "Intensif 5 hari membangun aplikasi web modern dari frontend hingga backend. Langsung mentored oleh praktisi industry.",
      tanggal: "2026-11-20", lokasi: "Gedung TEI, Lantai 3", waktu: "08.00 – 17.00 WIB",
      status: "Buka", kuota: 20
    },
    {
      id: 3, nama: "Open Recruitment: Tim Network Engineering", kategori: "Open Recruitment",
      deskripsi: "Bergabunglah dengan tim Network Engineering NEV. Cari pengalaman nyata di bidang infrastruktur dan sistem.",
      tanggal: "2026-11-01", lokasi: "Sekretariat NEV", waktu: "Fleksibel",
      status: "Buka", kuota: 5
    },
    {
      id: 4, nama: "Open Lab: Cybersecurity Essentials", kategori: "Open Lab",
      deskripsi: "Pelajari konsep keamanan siber: ethical hacking, vulnerability assessment, dan cara melindungi sistem dari ancaman.",
      tanggal: "2026-12-05", lokasi: "Lab Komputer NEV", waktu: "13.00 – 17.00 WIB",
      status: "Tutup", kuota: 25
    },
    {
      id: 5, nama: "Bootcamp: UI/UX Design Sprint", kategori: "Bootcamp",
      deskripsi: "Dua hari intensif mendesain antarmuka dan pengalaman pengguna yang efektif menggunakan Figma dan metodologi design thinking.",
      tanggal: "2026-12-12", lokasi: "Aula Kreatif NEV", waktu: "09.00 – 16.00 WIB",
      status: "Buka", kuota: 15
    },
    {
      id: 6, nama: "Open Recruitment: Content Creator & Social Media", kategori: "Open Recruitment",
      deskripsi: "NEV mencari anggota kreatif untuk mengelola konten digital dan media sosial komunitas. Cocok untuk kamu yang suka bercerita lewat visual.",
      tanggal: "2026-11-15", lokasi: "Online (via Discord)", waktu: "Fleksibel",
      status: "Buka", kuota: 3
    },
  ];
  renderEvents(state.events);
  updateImpactStats();
}

function updateImpactStats() {
  const el = document.getElementById("impactEvents");
  if (el) animateCounter(el, state.events.length);
}

function runImpactCounter(el, target) {
  const numericTarget = Number(target);
  if (!Number.isFinite(numericTarget) || numericTarget < 0 || el.dataset.countAnimated === "true") return;
  el.dataset.countAnimated = "true";
  const duration = 900;
  const startTime = performance.now();
  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(numericTarget * eased).toLocaleString("id-ID");
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function animateCounter(el, target) {
  if (!el) return;
  const sectionStats = el.closest("#impactStats");
  if (sectionStats) {
    el.dataset.countTarget = String(target);
    el.dataset.countAnimated = "false";
    el.textContent = "—";
    if (sectionStats.classList.contains("is-visible")) runImpactCounter(el, target);
    return;
  }
  runImpactCounter(el, target);
}

function initImpactStatsAnimation() {
  const stats = document.getElementById("impactStats");
  if (!stats) return;
  if (!("IntersectionObserver" in window)) {
    stats.classList.add("is-visible");
    stats.querySelectorAll("[data-count-target]").forEach(el => {
      if (el.dataset.countTarget !== "") runImpactCounter(el, el.dataset.countTarget);
    });
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      stats.classList.add("is-visible");
      stats.querySelectorAll("[data-count-target]").forEach(el => {
        if (el.dataset.countTarget !== "") runImpactCounter(el, el.dataset.countTarget);
      });
      observer.unobserve(stats);
    });
  }, { threshold: 0.25 });
  observer.observe(stats);
}

/* =========================================================
   TRAINERS
   ========================================================= */
function buildTrainerCard(t) {
  const avatar = t.foto
    ? `<img src="${sanitize(normalizePublicImageUrl(t.foto))}" alt="${sanitize(t.nama)}" loading="lazy">`
    : `<span>${(t.nama || "?")[0].toUpperCase()}</span>`;
  return `
    <div class="trainer-card">
      <div class="trainer-avatar">${avatar}</div>
      <div class="trainer-name">${sanitize(t.nama)}</div>
      <div class="trainer-role">${sanitize(t.jabatan || t.role || "Trainer")}</div>
      ${t.keahlian ? `<span class="trainer-badge">${sanitize(t.keahlian)}</span>` : ""}
      ${t.bio ? `<p class="trainer-bio">${sanitize(t.bio)}</p>` : ""}
      ${(t.instagram || t.linkedin) ? `<div class="trainer-socials">${t.instagram ? `<a href="${sanitize(t.instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram ${sanitize(t.nama)}">Instagram</a>` : ""}${t.linkedin ? `<a href="${sanitize(t.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn ${sanitize(t.nama)}">LinkedIn</a>` : ""}</div>` : ""}
    </div>`;
}

async function fetchTrainers() {
  const grid = document.getElementById("trainerGrid");
  if (!grid) return;
  try {
    const data = await apiFetch({ action: "getTrainers" });
    state.trainers = Array.isArray(data) ? data : (data.trainers || []);
    if (!state.trainers.length) throw new Error("empty");
    grid.innerHTML = state.trainers.map(buildTrainerCard).join("");
  } catch {
    // Demo trainers
    state.trainers = [
      { nama: "Andi Prasetyo", jabatan: "Network Engineer", keahlian: "Routing & Switching" },
      { nama: "Desi Wulandari", jabatan: "Cybersecurity Analyst", keahlian: "Ethical Hacking" },
      { nama: "Riza Fauzan", jabatan: "Full Stack Developer", keahlian: "Web Development" },
      { nama: "Novia Kurniasari", jabatan: "UI/UX Designer", keahlian: "Figma & Design" },
    ];
    grid.innerHTML = state.trainers.map(buildTrainerCard).join("");
  }
}

/* =========================================================
   EVENT MODAL
   ========================================================= */
function openEventModal(ev) {
  const modal = document.getElementById("eventModal");
  const content = document.getElementById("modalContent");
  if (!modal || !content) return;

  const isOpen = /buka|open/i.test(ev.status || "");
  const imgHtml = ev.gambar
    ? `<div class="modal-img"><img src="${sanitize(ev.gambar)}" alt="${sanitize(ev.nama)}"></div>`
    : `<div class="modal-img" style="font-size:3rem;">📋</div>`;

  content.innerHTML = `
    ${imgHtml}
    <div class="modal-body">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        ${categoryBadge(ev.kategori)}
        ${statusBadge(ev.status)}
      </div>
      <h2>${sanitize(ev.nama)}</h2>
      <div class="modal-meta">
        ${ev.tanggal ? `<div class="modal-meta-row">📅 ${formatDate(ev.tanggal)}</div>` : ""}
        ${ev.lokasi ? `<div class="modal-meta-row">📍 ${sanitize(ev.lokasi)}</div>` : ""}
        ${ev.waktu ? `<div class="modal-meta-row">🕐 ${sanitize(ev.waktu)}</div>` : ""}
        ${ev.kuota ? `<div class="modal-meta-row">👥 Kuota: ${sanitize(String(ev.kuota))} peserta</div>` : ""}
        ${ev.biaya ? `<div class="modal-meta-row">💰 ${sanitize(ev.biaya)}</div>` : `<div class="modal-meta-row">💰 Gratis</div>`}
      </div>
      <p>${sanitize(ev.deskripsi || "")}</p>
      ${ev.syarat ? `<p><strong>Syarat:</strong> ${sanitize(ev.syarat)}</p>` : ""}
      ${ev.persyaratanFoto ? `<div class="requirement-upload" style="margin:16px 0;padding:14px;border:1px solid var(--dark-4);border-radius:12px;"><label for="requirementPhoto" style="display:block;font-weight:600;margin-bottom:8px;">Foto persyaratan: ${sanitize(ev.persyaratanFoto)}</label><input id="requirementPhoto" type="file" accept="image/png,image/jpeg,image/webp" style="display:block;max-width:100%;"><small>PNG, JPG/JPEG, atau WEBP. Maksimal 5 MB; akan dikompres otomatis menjadi di bawah 1 MB.</small><div id="requirementPhotoStatus" aria-live="polite" style="margin-top:6px;"></div></div>` : ""}
      <div class="modal-actions">
        ${isOpen
          ? `<button class="btn btn-red" id="daftarBtn" data-event-id="${sanitize(String(ev.id || ev.nama))}">
               Daftar Sekarang ↗
             </button>`
          : `<button class="btn btn-outline" disabled>Pendaftaran Ditutup</button>`
        }
        <button class="btn btn-outline" id="closeModal2">Tutup</button>
      </div>
    </div>`;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.focus();

  document.getElementById("closeModal2")?.addEventListener("click", closeModal);
  document.getElementById("daftarBtn")?.addEventListener("click", () => handleDaftar(ev));
}

function closeModal() {
  const modal = document.getElementById("eventModal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}

async function handleDaftar(ev) {
  if (!state.user) {
    toast("Login terlebih dahulu untuk mendaftar.", "error");
    setTimeout(() => { window.location.href = "login.html"; }, 1000);
    return;
  }

  const btn = document.getElementById("daftarBtn");
  const photoInput = document.getElementById("requirementPhoto");
  const photoFile = photoInput?.files?.[0] || null;
  if (ev.persyaratanFoto && !photoFile) {
    toast("Unggah foto persyaratan terlebih dahulu.", "error");
    photoInput?.focus();
    return;
  }
  if (photoFile && photoFile.size > 5 * 1024 * 1024) {
    toast("Ukuran foto maksimal 5 MB.", "error");
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = "Memproses…"; }

  try {
    let requirementFileId = "";
    if (photoFile) {
      const status = document.getElementById("requirementPhotoStatus");
      if (status) status.textContent = "Mengompres dan mengunggah foto…";
      requirementFileId = await uploadRequirementPhoto(photoFile, ev);
    }
    const data = await apiFetch({
      action: "daftar",
      userId: state.user.id || state.user.email,
      eventId: ev.id || ev.nama,
      nama: state.user.nama,
      email: state.user.email,
      requirementFileId: requirementFileId,
      requirementFileName: photoFile ? photoFile.name : ""
    });

    if (data.success) {
      toast("Pendaftaran berhasil! Cek dashboard-mu.", "success");
      closeModal();
      fetchMyApplications();
    } else {
      toast(data.message || "Pendaftaran gagal. Coba lagi.", "error");
    }
  } catch {
    toast("Gagal terhubung ke server. Coba beberapa saat lagi.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Daftar Sekarang ↗"; }
  }
}


async function uploadRequirementPhoto(file, ev) {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Format foto harus PNG, JPG/JPEG, atau WEBP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto awal maksimal 5 MB.");
  const img = await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("File foto tidak dapat dibaca.")); };
    image.src = objectUrl;
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung kompresi gambar.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.82;
  let blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size >= 950 * 1024 && quality > 0.25) {
    quality = Math.max(0.25, quality - 0.1);
    blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob || blob.size >= 1024 * 1024) throw new Error("Foto belum bisa dikompres di bawah 1 MB. Coba gambar lain.");
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Gagal membaca foto."));
    reader.readAsDataURL(blob);
  });
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "uploadRequirementPhoto",
      userId: state.user.id || state.user.email,
      email: state.user.email || "",
      eventId: String(ev.id || ev.nama),
      fileName: file.name.replace(/\.[^.]+$/, ".jpg"),
      mimeType: "image/jpeg",
      base64
    })
  });
  const result = await response.json();
  if (!result.success || !result.fileId) throw new Error(result.message || "Upload foto gagal.");
  return result.fileId;
}

/* =========================================================
   MY APPLICATIONS
   ========================================================= */
function statusLabel(s) {
  const map = {
    "pending": { text: "Menunggu", cls: "badge-openlab" },
    "approved": { text: "Disetujui", cls: "badge-open" },
    "rejected": { text: "Ditolak", cls: "badge-closed" },
    "hadir": { text: "Hadir ✓", cls: "badge-open" },
  };
  const key = (s || "").toLowerCase();
  const info = map[key] || { text: sanitize(s || "—"), cls: "badge-openlab" };
  return `<span class="event-badge ${info.cls}">${info.text}</span>`;
}

async function fetchMyApplications() {
  if (!state.user) return;
  try {
    const data = await apiFetch({
      action: "getMyApplications",
      userId: state.user.id || state.user.email,
    });
    state.applications = Array.isArray(data) ? data : (data.applications || []);
    renderMyApplications();
  } catch {
    renderMyApplications();
  }
}

function renderMyApplications() {
  const container = document.getElementById("myApplications");
  const statsEl = document.getElementById("userStats");
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `<div class="empty-state">Login terlebih dahulu untuk melihat pendaftaran Anda.</div>`;
    return;
  }

  if (statsEl) {
    const approved = state.applications.filter(a => /approved|disetujui|hadir/i.test(a.status || "")).length;
    statsEl.innerHTML = `
      <div class="user-stat-card"><b>${state.applications.length}</b><span>Total Daftar</span></div>
      <div class="user-stat-card"><b>${approved}</b><span>Disetujui</span></div>
      <div class="user-stat-card"><b>${state.user.poin || 0}</b><span>Poin</span></div>`;
  }

  if (!state.applications.length) {
    container.innerHTML = `<div class="empty-state">Kamu belum mendaftar ke kegiatan apapun.</div>`;
    return;
  }

  container.innerHTML = state.applications.map(app => `
    <div class="app-card">
      <div class="app-card-icon">📋</div>
      <div class="app-card-body">
        <h4>${sanitize(app.namaEvent || app.eventId || "Kegiatan")}</h4>
        <p>Didaftarkan: ${formatDate(app.tanggalDaftar)} ${app.kategori ? "· " + sanitize(app.kategori) : ""}</p>
      </div>
      <div class="app-card-status">
        ${statusLabel(app.status)}
      </div>
    </div>`
  ).join("");
}

/* =========================================================
   FILTERS
   ========================================================= */
function initFilters() {
  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeFilter = btn.dataset.filter || "Semua";
      renderEvents(state.events);
    });
  });

  // Pathway card filter links
  document.querySelectorAll("[data-pathway-filter]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const filter = link.dataset.pathwayFilter;
      state.activeFilter = filter;
      document.querySelectorAll(".filter").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === filter);
      });
      renderEvents(state.events);
      document.getElementById("kegiatan")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* =========================================================
   HEADER SCROLL
   ========================================================= */
function initHeaderScroll() {
  const header = document.getElementById("topbar");
  if (!header) return;
  const onScroll = () => {
    if (window.scrollY > 20) {
      header.style.background = "rgba(13,13,15,.95)";
    } else {
      header.style.background = "rgba(13,13,15,.85)";
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* =========================================================
   PROFILE BUTTON
   ========================================================= */
function initProfileBtn() {
  const btn = document.getElementById("profileBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.location.href = "dashboard.html";
  });
}

/* =========================================================
   LOGOUT
   ========================================================= */
function initLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (confirm("Keluar dari akun?")) logout();
  });
}

/* =========================================================
   CLOSE MODAL
   ========================================================= */
function initModalClose() {
  document.getElementById("closeModal")?.addEventListener("click", closeModal);
  document.getElementById("eventModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

/* =========================================================
   ALUMNI COUNT & PESERTA COUNT
   ========================================================= */
async function fetchAlumniCount() {
  try {
    const data = await apiFetch({ action: "getAlumniCount" });
    const count = data.count ?? data.total ?? data;
    const el = document.getElementById("impactAlumniCount");
    if (el && typeof count === "number") animateCounter(el, count);
  } catch {
    // Keep default "—"
  }
}

async function fetchPesertaCount() {
  try {
    const data = await apiFetch({ action: "getPesertaCount" });
    const count = data.count ?? data.total ?? 0;
    const el = document.getElementById("impactPesertaCount");
    if (el && typeof count === "number") animateCounter(el, count);
  } catch {
    // Keep default "—"
  }
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  initImpactStatsAnimation();
  loadUser();
  updateAuthUI();
  initFilters();
  initHeaderScroll();
  initProfileBtn();
  initLogout();
  initModalClose();
  fetchEvents();
  fetchTrainers();
  fetchAlumniCount();
  fetchPesertaCount();
  if (state.user) {
    fetchMyApplications();
  }
});
