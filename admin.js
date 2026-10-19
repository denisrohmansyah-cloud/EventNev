/**
 * EventNev — admin.js
 * Admin portal for managing events, applications, and users
 */
"use strict";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgaSasJsN-J20DjJdKJ_0QHsA_8u_r9nqln6ZFFSrcPdljrMzZLkleEfqExnJvNMty/exec";

const adminState = {
  view: "stats",
  stats: {},
  events: [],
  applications: [],
  users: [],
  trainers: [],
  certificates: [],
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
    if (active) el.querySelector(".nev-loading-message").textContent = message || "Memproses permintaan admin…";
    if (nevLoadingCount === 0) el.remove();
  }
}
async function apiFetch(params) {
  setNevLoading(true, "Memproses permintaan admin…");
  try {
    const sessionToken = localStorage.getItem("nevSession") || "";
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...params, sessionToken })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const result = await res.json();
    if (result && result.success === false && /sesi admin/i.test(String(result.message || ""))) {
      localStorage.removeItem("nevSession");
      localStorage.removeItem("nevUser");
      window.location.href = "login.html?role=admin";
    }
    return result;
  } finally {
    setNevLoading(false);
  }
}

/* === AUTH === */
function checkAdmin() {
  try {
    const user = JSON.parse(localStorage.getItem("nevUser") || "{}");
    if (user.role !== "admin") {
      toast("Akses hanya untuk admin.", "error");
      setTimeout(() => window.location.href = "login.html?role=admin&v=20261018-2", 1500);
      return false;
    }
    document.getElementById("sidebarName").textContent = user.nama || "Admin";
    return true;
  } catch {
    window.location.href = "login.html?role=admin&v=20261018-2";
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
    case "attendance":   renderAttendance(); break;
    case "users":        renderUsers(); break;
    case "trainers":     renderTrainers(); break;
    case "certificates": renderCertificates(); break;
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
        <section class="admin-overview-section" style="margin-top:24px;">
        <div class="db-section-title">Kegiatan Terpublikasi <button class="btn btn-outline admin-btn-sm" onclick="renderStats()">↻ Perbarui</button></div>
        <div id="adminPublishedEvents" class="admin-published-grid"><div class="db-loading">Memuat kegiatan…</div></div>
      </section>
      <section class="admin-overview-section" style="margin-top:28px;">
        <div class="db-section-title">Pendaftaran Terbaru <button class="btn btn-outline admin-btn-sm" onclick="renderStats()">↻ Perbarui</button></div>
        <div id="adminLatestApplications" class="table-wrap"><div class="db-loading">Memuat pendaftaran…</div></div>
      </section>
      </div>
    `);
    await Promise.all([loadAdminPublishedEvents(), loadAdminLatestApplications()]);
  } catch {
    setContent('<div class="db-loading">Gagal memuat statistik.</div>');
  }
}

async function loadAdminPublishedEvents() {
  const el = document.getElementById("adminPublishedEvents");
  if (!el) return;
  try {
    const data = await apiFetch({ action: "getEvents" });
    const events = (Array.isArray(data) ? data : []).filter(ev => {
      const status = String(ev.status || "").toLowerCase();
      return !["draft", "drafts", "unpublished", "arsip", "archived", "nonaktif"].includes(status);
    });
    adminState.events = Array.isArray(data) ? data : [];
    el.innerHTML = events.length ? events.map(ev => {
      const poster = ev.gambar ? '<img src="' + sanitize(ev.gambar) + '" alt="Poster kegiatan" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="admin-published-placeholder">📅</div>';
      return '<article class="admin-published-card">' + poster + '<div class="admin-published-body"><span class="admin-published-status">' + sanitize(ev.status || "Terpublikasi") + '</span><h3>' + sanitize(ev.nama || "Kegiatan") + '</h3><p>' + sanitize(ev.kategori || "Kegiatan EventNev") + '</p><p>📅 ' + formatDate(ev.tanggal) + ' · 📍 ' + sanitize(ev.lokasi || "Lokasi menyusul") + '</p><button class="btn btn-outline admin-btn-sm" onclick="switchView(\'events\')">Kelola kegiatan</button></div></article>';
    }).join("") : '<div class="admin-overview-empty">Belum ada kegiatan yang dipublikasikan.</div>';
  } catch {
    el.innerHTML = '<div class="admin-overview-empty">Kegiatan gagal dimuat.</div>';
  }
}

async function loadAdminLatestApplications() {
  const el = document.getElementById("adminLatestApplications");
  if (!el) return;
  try {
    const data = await apiFetch({ action: "getAllApplications" });
    const apps = (Array.isArray(data) ? data : []).filter(a => !["cancelled", "dibatalkan"].includes(String(a.status || "").toLowerCase())).sort((a,b) => new Date(b.tanggalDaftar || 0) - new Date(a.tanggalDaftar || 0)).slice(0, 8);
    adminState.applications = Array.isArray(data) ? data : [];
    const rows = apps.map(app => '<tr><td>' + sanitize(app.namaEvent || app.eventId || "—") + '</td><td>' + sanitize(app.userId || "—") + '</td><td>' + formatDate(app.tanggalDaftar) + '</td><td><span class="admin-status-pill ' + sanitize(String(app.status || "pending").toLowerCase()) + '">' + sanitize(({pending:"Menunggu",menunggu:"Menunggu",approved:"Disetujui",rejected:"Ditolak",hadir:"Hadir"})[String(app.status || "pending").toLowerCase()] || app.status || "Menunggu") + '</span></td><td>' + (["pending","menunggu",""].includes(String(app.status || "pending").toLowerCase()) ? '<button class="btn btn-primary admin-btn-sm" onclick="quickUpdateAppStatus(\'' + sanitize(String(app.id)) + '\',\'approved\')">Setujui</button> <button class="btn btn-outline admin-btn-sm" style="color:#ff777f" onclick="quickUpdateAppStatus(\'' + sanitize(String(app.id)) + '\',\'rejected\')">Tolak</button>' : '<button class="btn btn-outline admin-btn-sm" onclick="switchView(\'applications\')">Detail</button>') + '</td></tr>').join("");
    el.innerHTML = apps.length ? '<table class="admin-table"><thead><tr><th>Kegiatan</th><th>Peserta ID</th><th>Tanggal daftar</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<div class="admin-overview-empty">Belum ada pendaftaran aktif.</div>';
  } catch {
    el.innerHTML = '<div class="admin-overview-empty">Pendaftaran gagal dimuat. Periksa deployment Apps Script.</div>';
  }
}

window.quickUpdateAppStatus = async function(appId, status) {
  const label = status === "approved" ? "menyetujui" : "menolak";
  if (!confirm("Yakin ingin " + label + " pendaftaran ini?")) return;
  try {
    const result = await apiFetch({ action: "updateStatus", appId, status });
    if (!result || !result.success) { toast(result?.message || "Status gagal diperbarui.", "error"); return; }
    toast(status === "approved" ? "Pendaftaran disetujui." : "Pendaftaran ditolak.", "success");
    await renderStats();
  } catch (err) {
    toast("Tidak dapat memperbarui pendaftaran.", "error");
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
    setContent('<div class="db-loading">Gagal memuat event. Periksa deployment Apps Script.</div>');
  }
}

function renderEventsTable() {
  const rows = adminState.events.map(ev => `
    <tr>
      <td>${sanitize(ev.nama)}</td><td>${sanitize(ev.kategori || "—")}</td>
      <td>${formatDate(ev.tanggal)}</td><td>${sanitize(ev.lokasi || "—")}</td>
      <td>${sanitize(ev.kuota || "—")}</td><td>${sanitize(ev.status || "—")}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-outline admin-btn-sm" onclick="editEvent('${sanitize(String(ev.id))}')">Edit</button><button class="btn btn-outline admin-btn-sm" style="border-color:#e1262f;color:#ff525b" onclick="deleteEvent('${sanitize(String(ev.id))}','${sanitize(ev.nama)}')">Hapus</button></div></td>
    </tr>`).join("") || '<tr><td colspan="7" style="text-align:center;padding:24px;">Belum ada event. Tambahkan event pertama.</td></tr>';
  setContent(`
    <section><div class="db-section-title">Kelola Event
      <button class="btn btn-red admin-btn-sm" onclick="showEventForm()">+ Tambah Event</button>
    </div><div id="eventFormWrap"></div>
    <div class="table-wrap"><table class="admin-table">
      <thead><tr><th>Nama Event</th><th>Kategori</th><th>Tanggal</th><th>Lokasi</th><th>Kuota</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody></table></div></section>`);
}

window.showEventForm = function(id = "") {
  const ev = adminState.events.find(x => String(x.id) === String(id)) || {};
  const wrap = document.getElementById("eventFormWrap");
  if (!wrap) return;
  wrap.innerHTML = `<form id="eventEditor" style="margin:16px 0;padding:20px;border:1px solid var(--dark-4);border-radius:var(--radius);background:var(--dark-2);">
    <h3 style="margin-bottom:16px;">${id ? "Edit Event" : "Tambah Event"}</h3>
    <input type="hidden" name="id" value="${sanitize(ev.id || "")}">
    <div class="admin-editor-grid">
      ${editorField("nama","Nama event",ev.nama,"text",true)}
      <label class="admin-editor-label">Kategori *<select name="kategori" required><option value="">Pilih kategori</option>${["Open Lab","Bootcamp","Open Recruitment"].map(x=>`<option value="${x}" ${ev.kategori===x?"selected":""}>${x}</option>`).join("")}</select></label>
      ${editorField("tanggal","Tanggal pelaksanaan",String(ev.tanggal || "").slice(0,10),"date",true)}
      ${editorField("batasPendaftaran","Penutupan pendaftaran",String(ev.batasPendaftaran || "").slice(0,10),"date")}
      <label class="admin-editor-label">Peserta untuk<select name="sasaran"><option value="">Semua sasaran</option>${["Mahasiswa","Siswa","Umum"].map(x=>`<option value="${x}" ${ev.sasaran===x?"selected":""}>${x}</option>`).join("")}</select></label>
      ${editorField("waktu","Waktu pelaksanaan",ev.waktu,"time")}
      ${editorField("lokasi","Lokasi",ev.lokasi,"text",true)}
      ${editorField("kuota","Kuota peserta",ev.kuota,"number")}
      ${editorField("biaya","Biaya",ev.biaya)}
      <label class="admin-editor-label">Status<select name="status"><option value="Buka" ${!ev.status || ev.status==="Buka" || ev.status==="Terbuka" ? "selected":""}>Terbuka</option><option value="Tutup" ${ev.status==="Tutup" ? "selected":""}>Ditutup</option></select></label>
      <label class="admin-editor-label">Foto event<input name="gambarFile" type="file" accept="image/*"><small>Format gambar, maksimal 5 MB.</small><input type="hidden" name="gambar" value="${sanitize(ev.gambar || "")}"></label>
    </div>
    <label class="admin-editor-label">Deskripsi<textarea name="deskripsi" rows="3">${sanitize(ev.deskripsi || "")}</textarea></label>
    <label class="admin-editor-label">Syarat<textarea name="syarat" rows="2">${sanitize(ev.syarat || "")}</textarea></label>
    <label class="admin-editor-label">Persyaratan foto peserta (kosongkan jika tidak wajib)<input name="persyaratanFoto" type="text" value="${sanitize(ev.persyaratanFoto || "")}" placeholder="Contoh: Foto KTM atau kartu identitas"></label>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-red" type="submit">Simpan Event</button><button class="btn btn-outline" type="button" onclick="document.getElementById('eventFormWrap').innerHTML=''">Batal</button></div>
  </form>`;
  document.getElementById("eventEditor").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const file = form.elements.gambarFile.files[0];
      if (file) { if (!file.type.startsWith("image/")) throw new Error("Pilih file gambar."); if (file.size > 5*1024*1024) throw new Error("Ukuran gambar maksimal 5 MB."); payload.gambar = await uploadAdminImage(file, "event"); }
      delete payload.gambarFile;
      const result = await apiFetch({ action: payload.id ? "updateEvent" : "addEvent", ...payload });
      if (!result.success) throw new Error(result.message || "Gagal menyimpan event.");
      toast("Event berhasil disimpan.", "success"); renderEvents();
    } catch (err) { toast(err.message || "Gagal menyimpan event.", "error"); }
  });
};
window.editEvent = id => window.showEventForm(id);

window.deleteEvent = async function(id, name) {
  if (!id) return toast("ID event tidak ditemukan.", "error");
  if (!confirm('Hapus event "' + name + '"? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    const result = await apiFetch({ action: "deleteEvent", eventId: id });
    if (!result || !result.success) throw new Error(result && result.message ? result.message : "Event gagal dihapus.");
    toast("Event berhasil dihapus.", "success");
    await renderEvents();
  } catch (err) {
    toast(err.message || "Gagal menghapus event.", "error");
  }
};

function editorField(name,label,value,type="text",required=false) {
  return `<label class="admin-editor-label">${label}${required ? " *" : ""}
    <input name="${name}" type="${type}" value="${sanitize(value ?? "")}" ${required ? "required" : ""}>
  </label>`;
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
  const pendingCount = adminState.applications.filter(app => ["pending", "menunggu", ""].includes(String(app.status || "pending").toLowerCase())).length;
  const rows = adminState.applications.map(app => {
    const status = String(app.status || "pending").toLowerCase();
    const statusLabel = ({pending:"Menunggu",menunggu:"Menunggu",approved:"Disetujui",rejected:"Ditolak"})[status] || status;
    const statusClass = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
    const searchable = [app.namaEvent,app.eventId,app.namaPeserta,app.nama,app.emailPeserta,app.userId,app.nimPeserta,app.universitasPeserta].join(" ").toLowerCase();
    return `
    <tr class="admin-application-row" data-status="${sanitize(status)}" data-search="${sanitize(searchable)}">
      <td data-label="Event">${sanitize(app.namaEvent || app.eventId || "—")}</td>
      <td data-label="Nama Peserta">
        <strong>${sanitize(app.namaPeserta || app.nama || "Nama belum tersedia")}</strong>
        <div class="admin-app-subtext">${sanitize(app.emailPeserta || "Email belum tersedia")}</div>
      </td>
      <td data-label="Tgl Daftar">${formatDate(app.tanggalDaftar)}</td>
      <td data-label="Status">
        <select class="admin-select" data-app-id="${sanitize(String(app.id))}" data-original-status="${sanitize(status)}" onchange="updateAppStatus(this)" aria-label="Status pendaftaran ${sanitize(app.namaPeserta || app.id)}">
          <option value="pending" ${["pending","menunggu",""].includes(status) ? "selected" : ""}>Menunggu</option>
          <option value="approved" ${status === "approved" ? "selected" : ""}>Disetujui</option>
          <option value="rejected" ${status === "rejected" ? "selected" : ""}>Ditolak</option>
        </select>
        <span class="admin-status-chip ${statusClass}">${sanitize(statusLabel)}</span>
      </td>
      <td data-label="Aksi" class="admin-app-actions">
        <button class="btn btn-outline admin-btn-sm" onclick="viewApplicantDetails('${sanitize(String(app.id))}')">Data diri</button>
        <button class="btn btn-outline admin-btn-sm" onclick="deleteApp('${sanitize(String(app.id))}')">Hapus</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:32px;">Belum ada pendaftaran.</td></tr>`;

  setContent(`
    <div class="admin-applications-page">
      <div class="db-section-title">Manajemen Pendaftaran (${adminState.applications.length})</div>
      <p class="admin-app-help">Ada <strong>${pendingCount}</strong> pendaftaran yang menunggu keputusan. Periksa data diri peserta sebelum menyetujui atau menolak.</p>
      <div class="admin-app-toolbar">
        <label class="admin-app-search"><span aria-hidden="true">⌕</span><input id="adminApplicationSearch" type="search" placeholder="Cari nama, email, NIM, atau kegiatan…" oninput="filterAdminApplications()" autocomplete="off"></label>
        <select id="adminApplicationStatusFilter" class="admin-select" onchange="filterAdminApplications()" aria-label="Filter status">
          <option value="all">Semua status</option><option value="pending">Menunggu</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option>
        </select>
        <button class="btn btn-outline admin-btn-sm" onclick="renderApplications()">↻ Perbarui</button>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Event</th><th>Nama Peserta</th><th>Tgl Daftar</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody id="adminApplicationsBody">${rows}</tbody>
        </table>
      </div>
      <p id="adminApplicationsEmpty" class="admin-app-empty" hidden>Tidak ada pendaftaran yang cocok dengan pencarian.</p>
    </div>
  `);
  filterAdminApplications();
}

window.filterAdminApplications = function() {
  const query = String(document.getElementById("adminApplicationSearch")?.value || "").trim().toLowerCase();
  const filter = String(document.getElementById("adminApplicationStatusFilter")?.value || "all").toLowerCase();
  let visible = 0;
  document.querySelectorAll("#adminApplicationsBody .admin-application-row").forEach(row => {
    const status = row.dataset.status || "pending";
    const statusMatch = filter === "all" || (filter === "pending" && ["pending","menunggu",""].includes(status)) || status === filter;
    const match = statusMatch && (row.dataset.search || "").includes(query);
    row.hidden = !match;
    if (match) visible++;
  });
  const empty = document.getElementById("adminApplicationsEmpty");
  if (empty) empty.hidden = visible > 0;
};


window.viewApplicantDetails = function(appId) {
  const app = adminState.applications.find(item => String(item.id) === String(appId));
  if (!app) { toast("Data pendaftaran tidak ditemukan.", "error"); return; }
  const field = (label, value) => `<div class="admin-app-detail-field"><span>${sanitize(label)}</span><strong>${sanitize(value || "Belum diisi")}</strong></div>`;
  const existing = document.getElementById("adminApplicantModal");
  existing?.remove();
  const modal = document.createElement("div");
  modal.id = "adminApplicantModal";
  modal.className = "admin-app-modal-backdrop";
  modal.innerHTML = `
    <section class="admin-app-modal" role="dialog" aria-modal="true" aria-labelledby="adminApplicantTitle">
      <header class="admin-app-modal-head"><div><h3 id="adminApplicantTitle">Data Diri Peserta</h3><p>Periksa informasi berikut sebelum mengambil keputusan.</p></div><button type="button" class="admin-app-modal-close" aria-label="Tutup" onclick="document.getElementById('adminApplicantModal')?.remove()">×</button></header>
      <div class="admin-app-detail-grid">
        ${field("Nama lengkap", app.namaPeserta || app.nama)}
        ${field("Email", app.emailPeserta)}
        ${field("Nomor WhatsApp", app.noHpPeserta)}
        ${field("NIM / NIS", app.nimPeserta)}
        ${field("Asal universitas / sekolah", app.universitasPeserta)}
        ${field("Fakultas", app.fakultasPeserta)}
        ${field("Program studi / jurusan", app.prodiPeserta)}
        ${field("Angkatan", app.angkatanPeserta)}
        ${field("Jenis akun", app.jenisPeserta)}
        ${field("Alamat", app.alamatPeserta)}
        ${field("Kegiatan", app.namaEvent || app.eventId)}
        ${field("Tanggal daftar", formatDate(app.tanggalDaftar))}
        ${field("Status pendaftaran", ({pending:"Menunggu",approved:"Disetujui",rejected:"Ditolak",hadir:"Hadir"})[String(app.status || "").toLowerCase()] || app.status)}
        ${field("Catatan peserta", app.catatan)}
      </div>
      <footer class="admin-app-modal-foot">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('adminApplicantModal')?.remove()">Tutup</button>
        ${String(app.status || "pending").toLowerCase() === "pending" || String(app.status || "pending").toLowerCase() === "menunggu" ? `<button type="button" class="btn btn-primary" onclick="document.getElementById('adminApplicantModal')?.remove();setApplicationStatus('${sanitize(String(app.id))}','approved')">Setujui</button><button type="button" class="btn btn-outline" onclick="document.getElementById('adminApplicantModal')?.remove();setApplicationStatus('${sanitize(String(app.id))}','rejected')">Tolak</button>` : ""}
      </footer>
    </section>`;
  modal.addEventListener("click", event => { if (event.target === modal) modal.remove(); });
  document.body.appendChild(modal);
};

window.setApplicationStatus = async function(appId, status) {
  const label = status === "approved" ? "menyetujui" : "menolak";
  if (!confirm("Yakin ingin " + label + " pendaftaran ini?")) return;
  try {
    const result = await apiFetch({ action: "updateStatus", appId, status });
    if (!result || !result.success) { toast(result?.message || "Status gagal diperbarui.", "error"); return; }
    toast(status === "approved" ? "Pendaftaran disetujui." : "Pendaftaran ditolak.", "success");
    await renderApplications();
  } catch {
    toast("Gagal terhubung ke server.", "error");
  }
};

window.updateAppStatus = async function(select) {
  const appId = select.dataset.appId;
  const status = select.value;
  const previous = select.dataset.originalStatus || "pending";
  if (status === previous) return;
  const app = adminState.applications.find(item => String(item.id) === String(appId));
  const name = app?.namaPeserta || app?.nama || "peserta ini";
  const action = status === "approved" ? "menyetujui" : status === "rejected" ? "menolak" : "mengembalikan ke status menunggu";
  if (!confirm("Yakin ingin " + action + " pendaftaran " + name + "?")) { select.value = previous; return; }
  select.disabled = true;
  try {
    const data = await apiFetch({ action: "updateStatus", appId, status });
    if (data && data.success) {
      select.dataset.originalStatus = status;
      toast(status === "approved" ? "Pendaftaran disetujui." : status === "rejected" ? "Pendaftaran ditolak." : "Status dikembalikan ke menunggu.", "success");
      await renderApplications();
    } else {
      select.value = previous;
      toast(data?.message || "Gagal memperbarui status.", "error");
    }
  } catch {
    select.value = previous;
    toast("Gagal terhubung ke server. Status tidak diubah.", "error");
  } finally {
    select.disabled = false;
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
/* --- ATTENDANCE --- */
async function renderAttendance() {
  setContent('<div class="db-loading">Memuat daftar kehadiran…</div>');
  try {
    const data = await apiFetch({ action: "getAllApplications" });
    adminState.applications = Array.isArray(data) ? data : [];
    const rows = adminState.applications
      .filter(app => ["approved", "hadir"].includes(String(app.status || "").toLowerCase()))
      .map(app => `
        <tr>
          <td>${sanitize(app.namaEvent || app.eventId || "—")}</td>
          <td><strong>${sanitize(app.namaPeserta || "Nama belum tersedia")}</strong><div class="admin-app-subtext">${sanitize(app.emailPeserta || "Email belum tersedia")}</div></td>
          <td>${formatDate(app.tanggalDaftar)}</td>
          <td><span class="event-badge ${String(app.status).toLowerCase()==="hadir"?"badge-success":"badge-openlab"}">${String(app.status).toLowerCase()==="hadir"?"Hadir":"Belum hadir"}</span></td>
          <td><button class="btn ${String(app.status).toLowerCase()==="hadir"?"btn-outline":"btn-primary"} admin-btn-sm" onclick="setAttendanceStatus('${sanitize(String(app.id))}','${String(app.status).toLowerCase()==="hadir"?"approved":"hadir"}')">${String(app.status).toLowerCase()==="hadir"?"Batalkan hadir":"Tandai hadir"}</button>
          <button class="btn btn-outline admin-btn-sm" onclick="viewApplicantDetails('${sanitize(String(app.id))}')">Data diri</button></td>
        </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:32px;">Belum ada peserta yang disetujui untuk dicatat kehadirannya.</td></tr>`;
    setContent(`<div><div class="db-section-title">Manajemen Kehadiran (${adminState.applications.filter(a=>["approved","hadir"].includes(String(a.status||"").toLowerCase())).length})</div><p class="admin-app-help">Pencatatan kehadiran dipisahkan dari keputusan pendaftaran. Hanya peserta yang sudah disetujui yang muncul di sini.</p><div class="table-wrap"><table class="admin-table"><thead><tr><th>Event</th><th>Nama Peserta</th><th>Tgl Daftar</th><th>Kehadiran</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
  } catch (err) {
    setContent('<div class="db-loading">Gagal memuat kehadiran. Periksa koneksi backend.</div>');
  }
}
window.setAttendanceStatus = async function(appId, status) {
  if (!confirm(status === "hadir" ? "Tandai peserta ini hadir?" : "Batalkan status hadir peserta ini?")) return;
  try {
    const result = await apiFetch({action:"updateStatus",appId,status});
    if (!result || !result.success) { toast(result?.message || "Status kehadiran gagal diperbarui.","error"); return; }
    toast(status === "hadir" ? "Kehadiran dicatat." : "Status hadir dibatalkan.","success");
    await renderAttendance();
  } catch { toast("Gagal terhubung ke server.","error"); }
};

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


/* --- CERTIFICATES --- */
async function renderCertificates() {
  setContent('<div class="db-loading">Memuat menu sertifikat…</div>');
  try {
    const results = await Promise.all([
      apiFetch({ action: "getUsers" }),
      apiFetch({ action: "getEvents" }),
      apiFetch({ action: "getCertificates" }),
      apiFetch({ action: "getAllApplications" })
    ]);
    adminState.users = Array.isArray(results[0]) ? results[0] : [];
    adminState.events = Array.isArray(results[1]) ? results[1] : [];
    if (results[2] && results[2].success === false) throw new Error(results[2].message || "Gagal memuat sertifikat.");
    adminState.certificates = Array.isArray(results[2]) ? results[2] : [];
    adminState.applications = Array.isArray(results[3]) ? results[3] : [];
    const participants = adminState.users.filter(u => String(u.jenis || "").toLowerCase() !== "admin");
    setContent(`
      <section class="admin-cert-shell">
        <div class="admin-cert-heading">
          <div><h2>Kelola Sertifikat Peserta</h2><p>Unggah sertifikat dan berikan langsung ke akun peserta agar dapat dilihat pada menu Sertifikat Saya.</p></div>
          <span class="admin-cert-count">🏆 ${adminState.certificates.length} sertifikat</span>
        </div>
        <form id="adminCertificateForm" class="admin-cert-form">
          <div class="admin-cert-form-title"><span>📤</span><div><h3>Unggah Sertifikat</h3><p>Isi data penerima dan pilih file sertifikat.</p></div></div>
          <div class="admin-editor-grid">
            <label class="admin-editor-label">Kegiatan *
              <select id="certEventId" required><option value="">Pilih kegiatan…</option>${adminState.events.map(ev => `<option value="${sanitize(ev.id)}" data-name="${sanitize(ev.nama)}">${sanitize(ev.nama)}</option>`).join("")}</select>
              <small>Hanya kegiatan yang memiliki peserta dengan status kehadiran Hadir yang dapat dipilih.</small>
            </label>
            <label class="admin-editor-label">Peserta hadir *
              <select id="certUserId" required disabled><option value="">Pilih kegiatan terlebih dahulu…</option></select>
              <small>Daftar peserta diambil dari catatan absensi dengan status Hadir.</small>
            </label>
            <label class="admin-editor-label">Nama sertifikat / kegiatan *
              <input id="certName" required maxlength="160" placeholder="Contoh: Sertifikat Open Lab Network Evolution">
            </label>
            <label class="admin-editor-label">Tanggal sertifikat
              <input id="certDate" type="date" value="${new Date().toISOString().slice(0,10)}">
            </label>
          </div>
          <label class="admin-editor-label admin-cert-file-label">File sertifikat *
            <input id="certFile" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,image/jpeg,image/png,image/webp,image/gif,application/pdf" required>
            <small>Format JPG, JPEG, PNG, WEBP, GIF, atau PDF. Maksimal 6 MB. File disimpan di Google Drive dan tautan diberikan kepada peserta.</small>
          </label>
          <div id="certFilePreview" class="admin-cert-file-preview" aria-live="polite">Belum ada file dipilih.</div>
          <div class="admin-cert-actions"><button class="btn btn-primary" type="submit" id="certSubmitBtn">Unggah & Berikan Sertifikat</button></div>
          <div id="certUploadMessage" class="admin-cert-message" role="status" aria-live="polite"></div>
        </form>
        <section class="admin-cert-list-section">
          <div class="db-section-title"><span>Sertifikat yang Sudah Diberikan</span><button type="button" class="btn btn-outline admin-btn-sm" id="certRefreshBtn">↻ Perbarui</button></div>
          <div class="table-wrap" id="adminCertificatesTable">${renderCertificatesTable()}</div>
        </section>
      </section>
    `);
    document.getElementById("certEventId")?.addEventListener("change", e => {
      const opt = e.target.selectedOptions[0];
      renderEligibleCertificateParticipants(e.target.value);
      if (opt && opt.dataset.name) document.getElementById("certName").value = "Sertifikat " + opt.dataset.name;
    });
    renderEligibleCertificateParticipants("");
    document.getElementById("certFile")?.addEventListener("change", e => {
      const file = e.target.files && e.target.files[0];
      const preview = document.getElementById("certFilePreview");
      if (!file) { preview.textContent = "Belum ada file dipilih."; return; }
      preview.innerHTML = '<span class="admin-cert-file-icon">' + (/^image\//.test(file.type) ? '🖼️' : '📄') + '</span><span><b>' + sanitize(file.name) + '</b><small>' + (file.size / 1024 / 1024).toFixed(2) + ' MB</small></span>';
    });
    document.getElementById("certRefreshBtn")?.addEventListener("click", renderCertificates);
    document.getElementById("adminCertificateForm")?.addEventListener("submit", uploadCertificateForParticipant);
  } catch (err) {
    setContent('<div class="admin-cert-error"><h3>Menu sertifikat belum dapat dimuat</h3><p>' + sanitize(err.message || "Periksa deployment Google Apps Script.") + '</p><button class="btn btn-outline" onclick="renderCertificates()">Coba lagi</button></div>');
  }
}

function renderEligibleCertificateParticipants(eventId) {
  const select = document.getElementById("certUserId");
  if (!select) return;
  const eligible = new Map();
  if (eventId) {
    adminState.applications
      .filter(app => String(app.eventId || "") === String(eventId) && /^hadir$/i.test(String(app.status || "").trim()))
      .forEach(app => {
        const userId = String(app.userId || "").trim();
        const user = adminState.users.find(u => String(u.id || "") === userId);
        if (user && String(user.jenis || "").toLowerCase() !== "admin") eligible.set(userId, user);
      });
  }
  const users = [...eligible.values()];
  select.disabled = !eventId || users.length === 0;
  select.innerHTML = !eventId
    ? '<option value="">Pilih kegiatan terlebih dahulu…</option>'
    : users.length
      ? '<option value="">Pilih peserta yang hadir…</option>' + users.map(u => '<option value="' + sanitize(u.id) + '">' + sanitize(u.nama) + ' — ' + sanitize(u.email) + '</option>').join("")
      : '<option value="">Belum ada peserta berstatus Hadir</option>';
}

function renderCertificatesTable() {
  if (!adminState.certificates.length) return '<div class="admin-overview-empty">Belum ada sertifikat yang diberikan.</div>';
  const usersById = Object.fromEntries(adminState.users.map(u => [String(u.id), u]));
  return '<table class="admin-table"><thead><tr><th>Peserta</th><th>Sertifikat</th><th>Tanggal</th><th>File</th></tr></thead><tbody>' +
    adminState.certificates.slice().sort((a,b) => String(b.tanggal || "").localeCompare(String(a.tanggal || ""))).map(c => {
      const user = usersById[String(c.userId)] || {};
      return '<tr><td><b>' + sanitize(user.nama || c.userId || "—") + '</b><br><small>' + sanitize(user.email || "") + '</small></td><td>' + sanitize(c.namaEvent || c.nama || "Sertifikat") + '</td><td>' + formatDate(c.tanggal) + '</td><td>' + (c.url ? '<a class="btn btn-outline admin-btn-sm" href="' + sanitize(c.url) + '" target="_blank" rel="noopener">Lihat / Unduh ↗</a>' : '—') + '</td></tr>';
    }).join("") + '</tbody></table>';
}

async function uploadCertificateForParticipant(event) {
  event.preventDefault();
  const form = document.getElementById("adminCertificateForm");
  const button = document.getElementById("certSubmitBtn");
  const message = document.getElementById("certUploadMessage");
  const file = document.getElementById("certFile")?.files?.[0];
  const userId = document.getElementById("certUserId")?.value || "";
  const eventSelect = document.getElementById("certEventId");
  const eventId = eventSelect?.value || "";
  const namaEvent = document.getElementById("certName")?.value.trim() || "";
  const tanggal = document.getElementById("certDate")?.value || new Date().toISOString().slice(0,10);
  if (!userId || !namaEvent || !file) { message.textContent = "Lengkapi peserta, nama sertifikat, dan file."; message.className = "admin-cert-message error"; return; }
  const allowed = ["image/jpeg","image/png","image/webp","image/gif","application/pdf"];
  if (!allowed.includes(file.type)) { message.textContent = "Format file tidak didukung. Pilih JPG, PNG, WEBP, GIF, atau PDF."; message.className = "admin-cert-message error"; return; }
  if (file.size > 6 * 1024 * 1024) { message.textContent = "Ukuran file maksimal 6 MB."; message.className = "admin-cert-message error"; return; }
  button.disabled = true; button.textContent = "Mengunggah…";
  message.textContent = "Mengunggah file dan menyimpan sertifikat…"; message.className = "admin-cert-message";
  try {
    const dataUrl = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("File tidak dapat dibaca.")); reader.readAsDataURL(file); });
    const admin = JSON.parse(localStorage.getItem("nevUser") || "{}");
    const response = await fetch(SCRIPT_URL, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify({action:"uploadCertificate",adminEmail:admin.email || "",userId,eventId,namaEvent,tanggal,fileName:file.name,mimeType:file.type,base64:String(dataUrl).split(",")[1]}) });
    const result = await response.json();
    if (!result || !result.success) throw new Error(result?.message || "Sertifikat gagal diunggah.");
    message.textContent = "✓ " + (result.message || "Sertifikat berhasil diberikan.");
    message.className = "admin-cert-message success";
    toast("Sertifikat berhasil diberikan kepada peserta.", "success");
    form.reset();
    document.getElementById("certDate").value = new Date().toISOString().slice(0,10);
    document.getElementById("certFilePreview").textContent = "Belum ada file dipilih.";
    const updated = await apiFetch({action:"getCertificates"});
    if (Array.isArray(updated)) adminState.certificates = updated;
    document.getElementById("adminCertificatesTable").innerHTML = renderCertificatesTable();
  } catch (err) {
    message.textContent = err.message || "Upload gagal. Coba lagi.";
    message.className = "admin-cert-message error";
    toast(message.textContent, "error");
  } finally {
    button.disabled = false; button.textContent = "Unggah & Berikan Sertifikat";
  }
}

/* --- TRAINERS --- */
async function renderTrainers() {
  setContent('<div class="db-loading">Memuat data trainer…</div>');
  try {
    const data = await apiFetch({ action: "getTrainers" });
    adminState.trainers = Array.isArray(data) ? data : [];
    renderTrainersTable();
  } catch {
    setContent('<div class="db-loading">Gagal memuat trainer. Periksa deployment Apps Script.</div>');
  }
}

function renderTrainersTable() {
  const rows = adminState.trainers.map(t => `<tr>
    <td>${sanitize(t.nama)}</td><td>${sanitize(t.jabatan || "—")}</td>
    <td>${sanitize(t.keahlian || "—")}</td>
    <td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-outline admin-btn-sm" onclick="editTrainer('${sanitize(String(t.id))}')">Edit</button><button class="btn btn-outline admin-btn-sm" style="border-color:#e1262f;color:#ff525b" onclick="deleteTrainer('${sanitize(String(t.id))}','${sanitize(t.nama)}')">Hapus</button></div></td>
  </tr>`).join("") || '<tr><td colspan="4" style="text-align:center;padding:24px;">Belum ada trainer. Tambahkan trainer pertama.</td></tr>';
  setContent(`<section><div class="db-section-title">Kelola Trainer
    <button class="btn btn-red admin-btn-sm" onclick="showTrainerForm()">+ Tambah Trainer</button></div>
    <div id="trainerFormWrap"></div><div class="table-wrap"><table class="admin-table">
    <thead><tr><th>Nama</th><th>Jabatan</th><th>Keahlian</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody>
    </table></div></section>`);
}

window.showTrainerForm = function(id = "") {
  const t = adminState.trainers.find(x => String(x.id) === String(id)) || {};
  const wrap = document.getElementById("trainerFormWrap");
  if (!wrap) return;
  wrap.innerHTML = `<form id="trainerEditor" style="margin:16px 0;padding:20px;border:1px solid var(--dark-4);border-radius:var(--radius);background:var(--dark-2);">
    <h3 style="margin-bottom:16px;">${id ? "Edit Trainer" : "Tambah Trainer"}</h3>
    <input type="hidden" name="id" value="${sanitize(t.id || "")}">
    <div class="admin-editor-grid">
      ${editorField("nama","Nama trainer",t.nama,"text",true)}
      ${editorField("jabatan","Jabatan",t.jabatan,"text",true)}
      ${editorField("keahlian","Keahlian",t.keahlian,"text",true)}
      <label class="admin-editor-label">Foto trainer<input name="fotoFile" type="file" accept="image/*"><small>Format gambar, maksimal 5 MB.</small><input type="hidden" name="foto" value="${sanitize(t.foto || "")}"></label>
      ${editorField("urutan","Urutan tampil",t.urutan || "1","number")}
    </div>
    <label class="admin-editor-label">Bio<textarea name="bio" rows="3">${sanitize(t.bio || "")}</textarea></label>
    <div class="admin-editor-grid">
      ${editorField("instagram","Link Instagram",t.instagram,"url")}
      ${editorField("linkedin","Link LinkedIn",t.linkedin,"url")}
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-red" type="submit">Simpan Trainer</button><button class="btn btn-outline" type="button" onclick="document.getElementById('trainerFormWrap').innerHTML=''">Batal</button></div>
  </form>`;
  document.getElementById("trainerEditor").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const file = form.elements.fotoFile.files[0];
      if (file) { if (!file.type.startsWith("image/")) throw new Error("Pilih file gambar."); if (file.size > 5*1024*1024) throw new Error("Ukuran gambar maksimal 5 MB."); payload.foto = await uploadAdminImage(file, "trainer"); }
      delete payload.fotoFile;
      const result = await apiFetch({ action: payload.id ? "updateTrainer" : "addTrainer", ...payload });
      if (!result.success) throw new Error(result.message || "Gagal menyimpan trainer.");
      toast("Trainer berhasil disimpan.", "success"); renderTrainers();
    } catch (err) { toast(err.message || "Gagal menyimpan trainer.", "error"); }
  });
};
window.editTrainer = id => window.showTrainerForm(id);

window.deleteTrainer = async function(id, name) {
  if (!id) return toast("ID trainer tidak ditemukan.", "error");
  if (!confirm('Hapus trainer "' + name + '"? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    const result = await apiFetch({ action: "deleteTrainer", trainerId: id });
    if (!result || !result.success) throw new Error(result && result.message ? result.message : "Trainer gagal dihapus.");
    toast("Trainer berhasil dihapus.", "success");
    await renderTrainers();
  } catch (err) { toast(err.message || "Gagal menghapus trainer.", "error"); }
};

async function uploadAdminImage(file, kind) {
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Gagal membaca gambar.")); reader.readAsDataURL(file); });
  const response = await fetch(SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "uploadAdminImage", kind, fileName: file.name, mimeType: file.type, base64: String(dataUrl).split(",")[1], adminEmail: (JSON.parse(localStorage.getItem("nevUser") || "{}").email || "") }) });
  const result = await response.json();
  if (!result || !result.success || !result.url) throw new Error(result?.message || "Backend uploadAdminImage belum tersedia di Apps Script.");
  return result.url;
}

function getSpreadsheetId() { return "1seqC8RhKYpAZ4FQRjhkz3E7KL76ZfyW9mbzkEsseUFY"; }

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
      window.location.href = "login.html?role=admin&v=20261018-2";
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
