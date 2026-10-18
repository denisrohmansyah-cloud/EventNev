/**
 * EventNev — dashboard.js
 * Participant dashboard logic
 */
"use strict";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbybwMPI1cbVV8pGJvjnC3Uq_kg6llnzoCX5XoyJhbXc8nFu8YjNoItf65Ywojtr6KW1/exec";

const state = {
  user: null,
  applications: [],
  certificates: [],
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
  try { return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
}

async function apiFetch(params) {
  const url = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
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
    window.location.href = "login.html";
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
    "pending":  { text: "Menunggu", cls: "badge-openlab" },
    "approved": { text: "Disetujui ✓", cls: "badge-open" },
    "rejected": { text: "Ditolak", cls: "badge-closed" },
    "hadir":    { text: "Hadir ✓", cls: "badge-open" },
  };
  const s = (app.status || "pending").toLowerCase();
  const info = statusMap[s] || { text: sanitize(app.status || "—"), cls: "badge-openlab" };
  return `
    <div class="db-app-card">
      <div class="db-app-icon">📋</div>
      <div class="db-app-info">
        <h4>${sanitize(app.namaEvent || app.eventId || "Kegiatan")}</h4>
        <p>${sanitize(app.kategori || "")} ${app.tanggalDaftar ? "· Daftar: " + formatDate(app.tanggalDaftar) : ""}</p>
      </div>
      <div class="db-app-status">
        <span class="event-badge ${info.cls}">${info.text}</span>
      </div>
    </div>`;
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
  await Promise.all([fetchApplications(), fetchCertificates()]);
  renderOverview();
});
