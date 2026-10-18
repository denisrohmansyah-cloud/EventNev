/**
 * EventNev — admin.js
 * Admin portal for managing events, applications, and users
 */
"use strict";

const SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

const adminState = {
  view: "stats",
  stats: {},
  events: [],
  applications: [],
  users: [],
  trainers: [],
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
  try { return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }
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
function checkAdmin() {
  try {
    const user = JSON.parse(localStorage.getItem("nevUser") || "{}");
    if (user.role !== "admin") {
      toast("Akses hanya untuk admin.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return false;
    }
    document.getElementById("sidebarName").textContent = user.nama || "Admin";
    return true;
  } catch {
    window.location.href = "login.html?role=admin";
    return false;
  }
}

/* === SET CONTENT === */
function setContent(html) {
  const el = document.getElementById("adminContent");
  if (el) el.innerHTML = html;
}

/* === VIEWS === */
function switchView(v) {
  adminState.view = v;
  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === v);
  });
  renderView();
}

function renderView() {
  switch (adminState.view) {
    case "stats":        renderStats(); break;
    case "events":       renderEvents(); break;
    case "applications": renderApplications(); break;
    case "users":        renderUsers(); break;
    case "trainers":     renderTrainers(); break;
  }
}

/* --- STATS --- */
async function renderStats() {
  setContent('<div class="db-loading">Memuat statistik…</div>');
  try {
    const data = await apiFetch({ action: "getStats" });
    adminState.stats = data;
    setContent(`
      <div>
        <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:24px;">Dashboard Admin</h2>
        <div class="db-stats-row">
          <div class="db-stat"><div class="db-stat-icon">👥</div><b>${data.users || 0}</b><span>Total Peserta</span></div>
          <div class="db-stat"><div class="db-stat-icon">📅</div><b>${data.events || 0}</b><span>Total Event</span></div>
          <div class="db-stat"><div class="db-stat-icon">📋</div><b>${data.applications || 0}</b><span>Pendaftaran</span></div>
          <div class="db-stat"><div class="db-stat-icon">✅</div><b>${data.approved || 0}</b><span>Disetujui</span></div>
        </div>
        <div style="margin-top:16px;padding:20px;background:var(--dark-2);border:1px solid var(--dark-4);border-radius:var(--radius);">
          <p style="font-size:.9rem;color:var(--text-dim);">Pilih menu di sidebar untuk mengelola konten portal EventNev.</p>
        </div>
      </div>
    `);
  } catch {
    setContent('<div class="db-loading">Gagal memuat statistik.</div>');
  }
}

/* --- EVENTS --- */
async function renderEvents() {
  setContent('<div class="db-loading">Memuat data event…</div>');
  try {
    const data = await apiFetch({ action: "getEvents" });
    adminState.events = Array.isArray(data) ? data : [];
    renderEventsTable();
  } catch {
    setContent('<div class="db-loading">Gagal memuat event. Pastikan SCRIPT_URL sudah benar.</div>');
  }
}

function renderEventsTable() {
  const rows = adminState.events.map(ev => `
    <tr>
      <td>${sanitize(ev.nama)}</td>
      <td><span class="event-badge badge-openlab">${sanitize(ev.kategori)}</span></td>
      <td>${formatDate(ev.tanggal)}</td>
      <td>${sanitize(ev.lokasi || "—")}</td>
      <td>${sanitize(ev.kuota || "—")}</td>
      <td>
        <span class="event-badge ${/buka|open/i.test(ev.status || "") ? "badge-open" : "badge-closed"}">
          ${/buka|open/i.test(ev.status || "") ? "Buka" : "Tutup"}
        </span>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:32px;">Belum ada event.</td></tr>`;

  setContent(`
    <div>
      <div class="db-section-title">
        Daftar Event (${adminState.events.length})
        <a href="https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/edit" target="_blank"
           class="btn btn-outline admin-btn-sm">Tambah via Spreadsheet ↗</a>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nama Event</th>
              <th>Kategori</th>
              <th>Tanggal</th>
              <th>Lokasi</th>
              <th>Kuota</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="margin-top:12px;font-size:.78rem;color:var(--text-dim);">
        Untuk menambah/mengubah event, edit langsung di Google Spreadsheet sheet <strong>Events</strong>.
      </p>
    </div>
  `);
}

/* --- APPLICATIONS --- */
async function renderApplications() {
  setContent('<div class="db-loading">Memuat pendaftaran…</div>');
  try {
    // Note: admin getApplications needs admin endpoint in Code.gs
    const data = await apiFetch({ action: "getAllApplications" });
    adminState.applications = Array.isArray(data) ? data : [];
    renderApplicationsTable();
  } catch {
    adminState.applications = [];
    renderApplicationsTable();
  }
}

function renderApplicationsTable() {
  const rows = adminState.applications.map(app => `
    <tr>
      <td>${sanitize(app.namaEvent || app.eventId || "—")}</td>
      <td>${sanitize(app.userId)}</td>
      <td>${formatDate(app.tanggalDaftar)}</td>
      <td>
        <select class="admin-select" data-app-id="${sanitize(String(app.id))}" onchange="updateAppStatus(this)">
          <option value="pending" ${app.status === "pending" ? "selected" : ""}>Menunggu</option>
          <option value="approved" ${app.status === "approved" ? "selected" : ""}>Setujui</option>
          <option value="rejected" ${app.status === "rejected" ? "selected" : ""}>Tolak</option>
          <option value="hadir" ${app.status === "hadir" ? "selected" : ""}>Hadir</option>
        </select>
      </td>
      <td>
        <button class="btn btn-outline admin-btn-sm" onclick="deleteApp('${sanitize(String(app.id))}')">Hapus</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:32px;">Belum ada pendaftaran.</td></tr>`;

  setContent(`
    <div>
      <div class="db-section-title">Manajemen Pendaftaran (${adminState.applications.length})</div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>User ID</th>
              <th>Tgl Daftar</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);
}

window.updateAppStatus = async function(select) {
  const appId = select.dataset.appId;
  const status = select.value;
  try {
    const data = await apiFetch({ action: "updateStatus", appId, status });
    if (data.success) toast("Status diperbarui.", "success");
    else toast(data.message || "Gagal memperbarui.", "error");
  } catch {
    toast("Gagal terhubung ke server.", "error");
  }
};

window.deleteApp = async function(appId) {
  if (!confirm("Hapus pendaftaran ini?")) return;
  try {
    const data = await apiFetch({ action: "deleteApp", appId });
    if (data.success) {
      toast("Pendaftaran dihapus.", "success");
      renderApplications();
    } else toast(data.message || "Gagal menghapus.", "error");
  } catch {
    toast("Gagal terhubung ke server.", "error");
  }
};

/* --- USERS --- */
async function renderUsers() {
  setContent('<div class="db-loading">Memuat data peserta…</div>');
  try {
    const data = await apiFetch({ action: "getUsers" });
    adminState.users = Array.isArray(data) ? data : [];
    const rows = adminState.users.map(u => `
      <tr>
        <td>${sanitize(u.nama)}</td>
        <td>${sanitize(u.email)}</td>
        <td>${sanitize(u.noHp || "—")}</td>
        <td><span class="event-badge badge-openlab">${sanitize(u.jenis || "—")}</span></td>
        <td>${formatDate(u.createdAt)}</td>
        <td>${sanitize(String(u.poin || 0))}</td>
      </tr>
    `).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:32px;">Belum ada peserta.</td></tr>`;

    setContent(`
      <div>
        <div class="db-section-title">Daftar Peserta (${adminState.users.length})</div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>No HP</th>
                <th>Jenis</th>
                <th>Tgl Daftar</th>
                <th>Poin</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `);
  } catch {
    setContent('<div class="db-loading">Gagal memuat data peserta.</div>');
  }
}

/* --- TRAINERS --- */
async function renderTrainers() {
  setContent('<div class="db-loading">Memuat data trainer…</div>');
  try {
    const data = await apiFetch({ action: "getTrainers" });
    adminState.trainers = Array.isArray(data) ? data : [];
    const rows = adminState.trainers.map(t => `
      <tr>
        <td>${sanitize(t.nama)}</td>
        <td>${sanitize(t.jabatan || "—")}</td>
        <td>${sanitize(t.keahlian || "—")}</td>
      </tr>
    `).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--text-dim);padding:32px;">Belum ada trainer.</td></tr>`;

    setContent(`
      <div>
        <div class="db-section-title">
          Daftar Trainer (${adminState.trainers.length})
          <a href="https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/edit" target="_blank"
             class="btn btn-outline admin-btn-sm">Edit via Spreadsheet ↗</a>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Nama</th><th>Jabatan</th><th>Keahlian</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `);
  } catch {
    setContent('<div class="db-loading">Gagal memuat data trainer.</div>');
  }
}

function getSpreadsheetId() {
  return "GANTI_DENGAN_ID_SPREADSHEET_KAMU";
}

/* === SIDEBAR === */
function initSidebar() {
  document.querySelectorAll(".sidebar-item").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

/* === LOGOUT === */
function initLogout() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("Keluar?")) {
      localStorage.removeItem("nevUser");
      window.location.href = "login.html?role=admin";
    }
  });
}

/* === INIT === */
document.addEventListener("DOMContentLoaded", () => {
  if (!checkAdmin()) return;
  initSidebar();
  initLogout();
  renderStats();
});
