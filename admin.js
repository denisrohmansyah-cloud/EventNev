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
  const sessionUser = JSON.parse(localStorage.getItem("nevUser") || "{}");
  if (sessionUser.email) url.searchParams.set("adminEmail", sessionUser.email);
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
    setContent('<div class="db-loading">Gagal memuat event. Periksa deployment Apps Script.</div>');
  }
}

function renderEventsTable() {
  const rows = adminState.events.map(ev => `
    <tr>
      <td>${sanitize(ev.nama)}</td><td>${sanitize(ev.kategori || "—")}</td>
      <td>${formatDate(ev.tanggal)}</td><td>${sanitize(ev.lokasi || "—")}</td>
      <td>${sanitize(ev.kuota || "—")}</td><td>${sanitize(ev.status || "—")}</td>
      <td><button class="btn btn-outline admin-btn-sm" onclick="editEvent('${sanitize(String(ev.id))}')">Edit</button></td>
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
      ${editorField("tanggal","Tanggal pelaksanaan *",String(ev.tanggal || "").slice(0,10),"date",true)}
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
    renderTrainersTable();
  } catch {
    setContent('<div class="db-loading">Gagal memuat trainer. Periksa deployment Apps Script.</div>');
  }
}

function renderTrainersTable() {
  const rows = adminState.trainers.map(t => `<tr>
    <td>${sanitize(t.nama)}</td><td>${sanitize(t.jabatan || "—")}</td>
    <td>${sanitize(t.keahlian || "—")}</td>
    <td><button class="btn btn-outline admin-btn-sm" onclick="editTrainer('${sanitize(String(t.id))}')">Edit</button></td>
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

async function uploadAdminImage(file, kind) {
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Gagal membaca gambar.")); reader.readAsDataURL(file); });
  const result = await apiFetch({ action: "uploadAdminImage", kind, fileName: file.name, mimeType: file.type, base64: String(dataUrl).split(",")[1] });
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
