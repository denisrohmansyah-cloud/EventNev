/**
 * EventNev — dashboard.js
 * Participant dashboard logic
 */
"use strict";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgaSasJsN-J20DjJdKJ_0QHsA_8u_r9nqln6ZFFSrcPdljrMzZLkleEfqExnJvNMty/exec";

const state = {
  user: null,
  applications: [],
  certificates: [],
  events: [],
  view: "overview",
};

/* === UTILS === */
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3500);
}

function sanitize(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  } catch { return String(d); }
}

function formatEventTime(value) {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();
  // Spreadsheet time-only cells may arrive as an ISO timestamp on 30 Dec 1899.
  const legacy = raw.match(/^1899-12-30T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$/i);
  if (legacy) {
    // Google Sheets serializes local spreadsheet time as UTC; convert to WIB.
    const total = (Number(legacy[1]) * 60 + Number(legacy[2]) + 7 * 60) % (24 * 60);
    return String(Math.floor(total / 60)).padStart(2, "0") + "." + String(total % 60).padStart(2, "0") + " WIB";
  }
  const simple = raw.match(/^(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?$/);
  if (simple) return String(Number(simple[1])).padStart(2, "0") + "." + simple[2] + " WIB";
  // If the source contains a human-readable range, retain it as entered.
  if (!/^\d{4}-\d\d-\d\dT/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).replace(":", ".") + " WIB";
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
    if (active) el.querySelector(".nev-loading-message").textContent = message || "Memuat data akun…";
    if (nevLoadingCount === 0) el.remove();
  }
}
async function apiFetch(params) {
  setNevLoading(true, "Memuat data akun…");
  try {
    const url = new URL(SCRIPT_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    setNevLoading(false);
  }
}

/* === AUTH === */
function loadUser() {
  try {
    const raw = localStorage.getItem("nevUser");
    state.user = raw ? JSON.parse(raw) : null;
  } catch { state.user = null; }
}

function checkAuth() {
  if (!state.user) {
    window.location.href = "login.html?v=20261018-2";
    return false;
  }
  return true;
}

/* === SIDEBAR === */
function initSidebar() {
  const profile = state.user;
  const avatar = document.getElementById("sidebarAvatar");
  const name = document.getElementById("sidebarName");
  const role = document.getElementById("sidebarRole");

  if (avatar) avatar.textContent = (profile?.nama || "?")[0].toUpperCase();
  if (name) name.textContent = profile?.nama || "—";
  if (role) role.textContent = profile?.jenis || profile?.role || "Peserta";

  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.view;
      renderView();
    });
  });
}

/* === VIEWS === */
function renderView() {
  switch (state.view) {
    case "overview": renderOverview(); break;
    case "applications": renderApplications(); break;
    case "certificates": renderCertificates(); break;
    case "profile": renderProfile(); break;
  }
}

function setContent(html) {
  const el = document.getElementById("dashboardContent");
  if (el) el.innerHTML = html;
}

/* --- OVERVIEW --- */
function renderOverview() {
  const approved = state.applications.filter(a => /approved|disetujui|hadir/i.test(a.status || "")).length;
  const pending = state.applications.filter(a => /pending|menunggu/i.test(a.status || "")).length;
  const certs = state.certificates.length;

  const recentApps = state.applications.slice(0, 3);

  setContent(`
    <div>
      <h2 style="font-size:1.3rem;font-weight:800;margin-bottom:8px;">Selamat datang, ${sanitize(state.user?.nama?.split(" ")[0] || "Peserta")} 👋</h2>
      <p style="color:var(--text-dim);font-size:.875rem;margin-bottom:28px;">Pantau semua aktivitasmu di sini.</p>

      <div class="db-stats-row">
        <div class="db-stat">
          <div class="db-stat-icon">📋</div>
          <b>${state.applications.length}</b>
          <span>Total Daftar</span>
        </div>
        <div class="db-stat">
          <div class="db-stat-icon">✅</div>
          <b>${approved}</b>
          <span>Disetujui</span>
        </div>
        <div class="db-stat">
          <div class="db-stat-icon">⏳</div>
          <b>${pending}</b>
          <span>Menunggu</span>
        </div>
        <div class="db-stat">
          <div class="db-stat-icon">🏆</div>
          <b>${certs}</b>
          <span>Sertifikat</span>
        </div>
      </div>

      <section class="db-events-section" aria-labelledby="availableEventsTitle">
        <div class="db-section-title">
          <span id="availableEventsTitle">Kegiatan Tersedia</span>
          <button class="btn btn-ghost" onclick="refreshDashboardEvents()" style="font-size:.78rem;">↻ Perbarui</button>
        </div>
        <p class="db-events-intro">Lihat kegiatan terbaru dan daftar langsung dari dashboard ini.</p>
        <div class="db-events-grid">
          ${state.events.length ? state.events.map(buildDashboardEventCard).join("") : '<div class="db-events-empty"><span>🗓️</span><strong>Belum ada kegiatan tersedia</strong><p>Kegiatan yang dipublikasikan admin akan muncul di sini.</p></div>'}
        </div>
      </section>

      ${recentApps.length ? `
        <div class="db-section-title">
          Pendaftaran terbaru
          <button class="btn btn-ghost" onclick="switchView('applications')" style="font-size:.78rem;">Lihat semua →</button>
        </div>
        <div class="db-app-list">
          ${recentApps.map(buildAppCard).join("")}
        </div>
      ` : `
        <div class="db-section-title">Pendaftaran</div>
        <div style="text-align:center;padding:48px 24px;color:var(--text-dim);">
          <div style="font-size:2rem;margin-bottom:12px;">📭</div>
          <p>Kamu belum mendaftar ke kegiatan apapun.</p>
          <a class="btn btn-red" href="index.html#kegiatan" style="margin-top:16px;display:inline-flex;">Jelajahi kegiatan ↗</a>
        </div>
      `}

      <div class="db-section-title" style="margin-top:32px;">QR Presensi Saya</div>
      <div class="qr-container">
        <div id="qrCode"></div>
        <p style="font-size:.8rem;color:var(--text-dim);">Tunjukkan QR ini saat absensi kegiatan</p>
      </div>
    </div>
  `);

  generateQR();
}

/* --- AVAILABLE EVENTS & DIRECT REGISTRATION --- */
function isDashboardEventOpen(ev) {
  const status = String(ev.status || "").trim().toLowerCase();
  return !status || /buka|open|available|aktif/i.test(status);
}
function normalizeDashboardImageUrl(value) {
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

function buildDashboardEventCard(ev) {
  const eventId = String(ev.id || ev.nama || '');
  const userId = state.user?.id || state.user?.email;
  const registered = state.applications.some(a => String(a.userId) === String(userId) && !["cancelled", "dibatalkan"].includes(String(a.status || "").toLowerCase()) && (String(a.eventId) === eventId || String(a.namaEvent || '') === String(ev.nama || '')));
  const open = isDashboardEventOpen(ev);
  const posterUrl = normalizeDashboardImageUrl(ev.gambar);
  const image = posterUrl ? '<img src="' + sanitize(posterUrl) + '" alt="' + sanitize(ev.nama || 'Poster kegiatan') + '" loading="lazy" referrerpolicy="no-referrer">' : '<div class="db-event-placeholder">📅</div>';
  const action = registered ? '<button class="db-event-action is-registered" disabled>✓ Sudah terdaftar</button>' : (!open ? '<button class="db-event-action" disabled>Pendaftaran ditutup</button>' : '<button class="db-event-action" onclick="openDashboardEventDetail(\'' + sanitize(eventId) + '\')">Lihat detail & daftar →</button>');
  return '<article class="db-event-card"><button type="button" class="db-event-image db-event-image-button" onclick="openDashboardEventDetail(\'' + sanitize(eventId) + '\')" aria-label="Lihat detail kegiatan">' + image + '</button><div class="db-event-content">' +
    '<div class="db-event-tags"><span class="db-event-tag">' + sanitize(ev.kategori || 'Kegiatan') + '</span><span class="db-event-status ' + (open ? 'open' : 'closed') + '">' + (open ? 'Pendaftaran dibuka' : sanitize(ev.status || 'Ditutup')) + '</span></div>' +
    '<h3>' + sanitize(ev.nama || 'Kegiatan') + '</h3><p class="db-event-description">' + sanitize(ev.deskripsi || 'Informasi kegiatan belum ditambahkan.') + '</p>' +
    '<div class="db-event-meta">' + (ev.tanggal ? '<span>📅 ' + formatDate(ev.tanggal) + '</span>' : '') + (ev.waktu ? '<span>🕒 ' + sanitize(formatEventTime(ev.waktu)) + '</span>' : '') + (ev.lokasi ? '<span>📍 ' + sanitize(ev.lokasi) + '</span>' : '') + '</div>' + action + '</div></article>';
}
function openDashboardEventDetail(eventId) {
  const ev = state.events.find(item => String(item.id || item.nama) === String(eventId));
  if (!ev) { toast('Detail kegiatan tidak ditemukan.', 'error'); return; }
  let modal = document.getElementById('dashboardEventModal');
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'dashboardEventModal'; modal.className = 'db-modal-backdrop'; modal.hidden = true;
    modal.innerHTML = '<section class="db-modal" role="dialog" aria-modal="true" aria-labelledby="dbModalTitle"><header class="db-modal-header"><h2 id="dbModalTitle">Detail Kegiatan</h2><button type="button" class="db-modal-close" aria-label="Tutup" onclick="closeDashboardEventDetail()">×</button></header><div class="db-modal-body" id="dbModalBody"></div><footer class="db-modal-footer" id="dbModalFooter"></footer></section>';
    modal.addEventListener('click', e => { if (e.target === modal) closeDashboardEventDetail(); }); document.body.appendChild(modal);
  }
  const userId = state.user?.id || state.user?.email;
  const registered = state.applications.some(a => String(a.userId) === String(userId) && !["cancelled", "dibatalkan"].includes(String(a.status || "").toLowerCase()) && (String(a.eventId) === String(eventId) || String(a.namaEvent || '') === String(ev.nama || '')));
  const open = isDashboardEventOpen(ev);
  document.getElementById('dbModalBody').innerHTML = (ev.gambar ? '<img class="db-modal-poster" src="' + sanitize(normalizeDashboardImageUrl(ev.gambar)) + '" alt="Poster kegiatan" loading="eager" referrerpolicy="no-referrer">' : '<div class="db-modal-poster-placeholder">📅</div>') + '<h3 class="db-modal-event-name">' + sanitize(ev.nama) + '</h3><div class="db-event-tags"><span class="db-event-tag">' + sanitize(ev.kategori || 'Kegiatan') + '</span><span class="db-event-status ' + (open ? 'open' : 'closed') + '">' + (open ? 'Pendaftaran dibuka' : sanitize(ev.status || 'Ditutup')) + '</span></div>' +
    '<div class="db-modal-info">' + (ev.tanggal ? '<div><span>Tanggal</span><strong>' + formatDate(ev.tanggal) + '</strong></div>' : '') + (ev.waktu ? '<div><span>Waktu</span><strong>' + sanitize(ev.waktu) + '</strong></div>' : '') + (ev.lokasi ? '<div><span>Lokasi</span><strong>' + sanitize(ev.lokasi) + '</strong></div>' : '') + (ev.biaya || ev.harga ? '<div><span>Biaya</span><strong>' + sanitize(ev.biaya || ev.harga) + '</strong></div>' : '') + '</div><h4>Deskripsi</h4><p class="db-modal-description">' + sanitize(ev.deskripsi || 'Informasi kegiatan belum ditambahkan.') + '</p>' + (ev.persyaratanFoto ? '<div class="db-modal-requirement"><strong>Persyaratan</strong><p>' + sanitize(ev.persyaratanFoto) + '</p><small>Unggah persyaratan melalui halaman Event sebelum mendaftar.</small></div>' : '');
  document.getElementById('dbModalFooter').innerHTML = '<button type="button" class="btn btn-outline" onclick="closeDashboardEventDetail()">Tutup</button>' + (registered ? '<button class="db-event-action is-registered" disabled>✓ Sudah terdaftar</button>' : (!open ? '<button class="db-event-action" disabled>Pendaftaran ditutup</button>' : (ev.persyaratanFoto ? '<button class="db-event-action" onclick="openDashboardEventRequirements(\'' + sanitize(eventId) + '\')">Lanjut ke persyaratan</button>' : '<button class="db-event-action" onclick="registerToEvent(\'' + sanitize(eventId) + '\')">Daftar sekarang →</button>')));
  modal.hidden = false; document.body.classList.add('db-modal-open');
}
function closeDashboardEventDetail() { const modal = document.getElementById('dashboardEventModal'); if (modal) modal.hidden = true; document.body.classList.remove('db-modal-open'); }
async function refreshDashboardEvents() {
  await fetchDashboardEvents();
  renderView();
  toast("Daftar kegiatan diperbarui.", "success");
}
function openDashboardEventRequirements(eventId) {
  toast("Kegiatan ini memerlukan foto persyaratan. Silakan buka halaman Event untuk mengunggahnya.", "info");
  window.location.href = "index.html#kegiatan";
}
async function registerToEvent(eventId) {
  const ev = state.events.find(item => String(item.id || item.nama) === String(eventId));
  if (!ev) { toast("Kegiatan tidak ditemukan. Muat ulang dashboard.", "error"); return; }
  if (!isDashboardEventOpen(ev)) { toast("Pendaftaran kegiatan ini sudah ditutup.", "error"); return; }
  const userId = state.user?.id || state.user?.email;
  if (!userId) { toast("Sesi peserta tidak ditemukan. Silakan login kembali.", "error"); return; }
  if (state.applications.some(a => String(a.userId) === String(userId) &&
      !["cancelled", "dibatalkan"].includes(String(a.status || "").toLowerCase()) &&
      (String(a.eventId) === String(eventId) || String(a.namaEvent || "") === String(ev.nama || "")))) {
    toast("Kamu sudah terdaftar pada kegiatan ini.", "info"); renderView(); return;
  }
  if (String(ev.persyaratanFoto || "").trim()) { openDashboardEventRequirements(eventId); return; }
  const button = Array.from(document.querySelectorAll(".db-event-action")).find(b => b.getAttribute("onclick")?.includes("registerToEvent"));
  if (button) { button.disabled = true; button.textContent = "Memproses…"; }
  try {
    const result = await apiFetch({ action: "daftar", userId, eventId: String(ev.id || ev.nama), nama: state.user.nama || "", email: state.user.email || "" });
    if (!result || !result.success) { toast(result?.message || "Pendaftaran gagal. Silakan coba lagi.", "error"); return; }
    await fetchApplications();
    renderView();
    toast(result.message || "Pendaftaran berhasil!", "success");
  } catch (err) {
    console.error("Pendaftaran dari dashboard gagal:", err);
    toast("Tidak dapat menghubungi server. Coba lagi.", "error");
  } finally {
    if (button && button.isConnected) { button.disabled = false; button.textContent = "Daftar sekarang →"; }
  }
}
async function fetchDashboardEvents() {
  try {
    const data = await apiFetch({ action: "getEvents" });
    const events = Array.isArray(data) ? data : (data?.events || []);
    state.events = events.filter(ev => ev && ev.id && ev.nama);
  } catch (err) {
    console.error("fetchDashboardEvents:", err);
    state.events = [];
  }
}

/* --- APPLICATIONS --- */
function renderApplications() {
  setContent(`
    <div>
      <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:24px;">Pendaftaran Saya</h2>
      <div class="db-app-list" id="appList">
        ${state.applications.length
          ? state.applications.map(buildAppCard).join("")
          : `<div style="text-align:center;padding:48px 24px;color:var(--text-dim);">
              <div style="font-size:2rem;margin-bottom:12px;">📭</div>
              <p>Belum ada pendaftaran.</p>
              <a class="btn btn-red" href="index.html#kegiatan" style="margin-top:16px;display:inline-flex;">Jelajahi kegiatan ↗</a>
             </div>`
        }
      </div>
    </div>
  `);
}

function buildAppCard(app) {
  const statusMap = {
    pending: { text: "Menunggu", cls: "badge-openlab" },
    approved: { text: "Disetujui ✓", cls: "badge-open" },
    rejected: { text: "Ditolak", cls: "badge-closed" },
    hadir: { text: "Hadir ✓", cls: "badge-open" },
    cancelled: { text: "Dibatalkan", cls: "badge-closed" },
    dibatalkan: { text: "Dibatalkan", cls: "badge-closed" }
  };
  const s = String(app.status || "pending").toLowerCase();
  const info = statusMap[s] || { text: sanitize(app.status || "—"), cls: "badge-openlab" };
  const canCancel = ["pending", "menunggu"].includes(s) && app.id;
  return '<div class="db-app-card"><div class="db-app-icon">📋</div><div class="db-app-info"><h4>' + sanitize(app.namaEvent || app.eventId || "Kegiatan") + '</h4><p>' + sanitize(app.kategori || "") + (app.tanggalDaftar ? " · Daftar: " + formatDate(app.tanggalDaftar) : "") + '</p>' +
    (canCancel ? '<button type="button" class="db-cancel-application" onclick="cancelMyApplication(\'' + sanitize(app.id) + '\')">Batalkan pendaftaran</button>' : "") +
    '</div><div class="db-app-status"><span class="event-badge ' + info.cls + '">' + info.text + '</span></div></div>';
}

async function cancelMyApplication(applicationId) {
  const app = state.applications.find(item => String(item.id) === String(applicationId));
  if (!app) { toast("Pendaftaran tidak ditemukan.", "error"); return; }
  if (!["pending", "menunggu"].includes(String(app.status || "pending").toLowerCase())) { toast("Pendaftaran ini sudah diproses dan tidak dapat dibatalkan dari dashboard.", "error"); return; }
  if (!confirm("Batalkan pendaftaran untuk " + (app.namaEvent || "kegiatan ini") + "? Tindakan ini tidak dapat diurungkan.")) return;
  try {
    const result = await apiFetch({ action: "cancelApplication", userId: state.user.id || state.user.email, applicationId: String(applicationId) });
    if (!result || !result.success) { toast(result?.message || "Pendaftaran gagal dibatalkan.", "error"); return; }
    await fetchApplications(); renderView(); toast(result.message || "Pendaftaran berhasil dibatalkan.", "success");
  } catch (err) { console.error("Pembatalan pendaftaran gagal:", err); toast("Tidak dapat menghubungi server. Coba lagi.", "error"); }
}

/* --- CERTIFICATES --- */
function renderCertificates() {
  setContent(`
    <div>
      <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:24px;">Sertifikat Saya</h2>
      ${state.certificates.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;">
            ${state.certificates.map(c => `
              <div style="background:var(--dark-2);border:1px solid var(--dark-4);border-radius:var(--radius);padding:20px;display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:2rem;">🏆</div>
                <div style="font-weight:700;font-size:.95rem;">${sanitize(c.namaEvent || c.nama)}</div>
                <div style="font-size:.78rem;color:var(--text-dim);">${formatDate(c.tanggal)}</div>
                ${c.url ? `<a href="${sanitize(c.url)}" target="_blank" class="btn btn-outline" style="font-size:.78rem;padding:8px 12px;margin-top:4px;">Unduh ↗</a>` : ""}
              </div>
            `).join("")}
           </div>`
        : `<div class="db-cert-empty"><p>Belum ada sertifikat. Ikuti kegiatan untuk mendapatkan sertifikat.</p></div>`
      }
    </div>
  `);
}

/* --- PROFILE --- */
function renderProfile() {
  const u = state.user || {};
  setContent(`
    <div>
      <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:24px;">Profil Saya</h2>
      <form class="db-profile-form" id="profileForm" novalidate>
        <div class="db-field">
          <label>Nama lengkap</label>
          <input type="text" id="editNama" value="${sanitize(u.nama || "")}" placeholder="Nama lengkap">
        </div>
        <div class="db-field">
          <label>Email</label>
          <input type="email" value="${sanitize(u.email || "")}" disabled>
        </div>
        <div class="db-field">
          <label>No. HP / WhatsApp</label>
          <input type="tel" id="editNoHp" value="${sanitize(u.noHp || u.noWa || "")}" placeholder="08xxxxxxxxxx">
        </div>
        <div class="db-field">
          <label>Jenis peserta</label>
          <input type="text" value="${sanitize(u.jenis || u.role || "Peserta")}" disabled>
        </div>
        <button type="submit" class="btn btn-red" style="width:fit-content;">Simpan Perubahan</button>
      </form>
    </div>
  `);

  document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nama = document.getElementById("editNama").value.trim();
    const noHp = document.getElementById("editNoHp").value.trim();
    if (!nama) { toast("Nama tidak boleh kosong.", "error"); return; }

    try {
      await apiFetch({ action: "updateProfile", userId: u.id || u.email, nama, noHp });
      state.user.nama = nama;
      state.user.noHp = noHp;
      localStorage.setItem("nevUser", JSON.stringify(state.user));
      const sidebarName = document.getElementById("sidebarName");
      if (sidebarName) sidebarName.textContent = nama;
      const sidebarAvatar = document.getElementById("sidebarAvatar");
      if (sidebarAvatar) sidebarAvatar.textContent = nama[0].toUpperCase();
      toast("Profil berhasil diperbarui!", "success");
    } catch {
      toast("Gagal menyimpan. Coba lagi.", "error");
    }
  });
}

/* === QR CODE === */
function generateQR() {
  const container = document.getElementById("qrCode");
  if (!container || !window.qrcode) return;

  const qrData = JSON.stringify({
    uid: state.user?.id || state.user?.email,
    nama: state.user?.nama,
    ts: Date.now(),
  });

  try {
    const qr = qrcode(0, "M");
    qr.addData(qrData);
    qr.make();
    container.innerHTML = qr.createImgTag(4, 4);
  } catch (err) {
    container.innerHTML = `<p style="color:var(--text-dim);font-size:.8rem;">QR tidak tersedia</p>`;
  }
}

/* === DATA FETCH === */
async function fetchApplications() {
  try {
    const data = await apiFetch({ action: "getMyApplications", userId: state.user.id || state.user.email });
    state.applications = Array.isArray(data) ? data : (data.applications || []);
  } catch {
    state.applications = [];
  }
}

async function fetchCertificates() {
  try {
    const data = await apiFetch({ action: "getMyCertificates", userId: state.user.id || state.user.email });
    state.certificates = Array.isArray(data) ? data : (data.certificates || []);
  } catch {
    state.certificates = [];
  }
}

/* === LOGOUT === */
function initLogout() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("Keluar dari akun?")) {
      localStorage.removeItem("nevUser");
      window.location.href = "index.html";
    }
  });
}

/* === SCANNER === */
function initScanner() {
  const scanBtn = document.getElementById("scanAbsenBtn");
  if (!scanBtn) return;
  scanBtn.addEventListener("click", () => {
    if (window.NEVScanner) window.NEVScanner.open();
    else {
      const overlay = document.getElementById("scannerOverlay");
      if (overlay) overlay.hidden = false;
    }
  });
  document.getElementById("closeScannerBtn")?.addEventListener("click", () => {
    if (window.NEVScanner) window.NEVScanner.close();
    const overlay = document.getElementById("scannerOverlay");
    if (overlay) overlay.hidden = true;
  });
}

/* === VIEW SWITCHER (global) === */
window.switchView = function(v) {
  state.view = v;
  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === v);
  });
  renderView();
};

/* === INIT === */
document.addEventListener("DOMContentLoaded", async () => {
  loadUser();
  if (!checkAuth()) return;

  initSidebar();
  initLogout();
  initScanner();

  setContent('<div class="db-loading">Memuat data…</div>');
  await Promise.all([fetchApplications(), fetchCertificates(), fetchDashboardEvents()]);
  renderOverview();
});
