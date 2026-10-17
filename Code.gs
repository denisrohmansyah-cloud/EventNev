/**
 * EventNev — Code.gs
 * Google Apps Script backend untuk portal EventNev
 * 
 * SETUP:
 * 1. Buat Google Spreadsheet baru
 * 2. Paste kode ini ke Apps Script (Extensions > Apps Script)
 * 3. Buat sheet: Users, Events, Applications, Trainers, Certificates
 * 4. Deploy sebagai Web App (Execute as: Me, Access: Anyone)
 * 5. Salin Deployment URL ke SCRIPT_URL di semua file .js
 */

const SPREADSHEET_ID = "GANTI_DENGAN_ID_SPREADSHEET_KAMU";

// Sheet names
const SHEET = {
  USERS:        "Users",
  EVENTS:       "Events",
  APPLICATIONS: "Applications",
  TRAINERS:     "Trainers",
  CERTIFICATES: "Certificates",
  SETTINGS:     "Settings",
};

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || "";

  try {
    let result;
    switch (action) {
      case "login":           result = handleLogin(params); break;
      case "register":        result = handleRegister(params); break;
      case "updateProfile":   result = handleUpdateProfile(params); break;
      case "getEvents":       result = handleGetEvents(params); break;
      case "getTrainers":     result = handleGetTrainers(params); break;
      case "getAlumniCount":  result = handleAlumniCount(params); break;
      case "daftar":          result = handleDaftar(params); break;
      case "getMyApplications": result = handleGetMyApplications(params); break;
      case "getMyCertificates": result = handleGetMyCertificates(params); break;
      case "absen":           result = handleAbsen(params); break;
      // Admin
      case "getUsers":        result = adminGetUsers(params); break;
      case "updateStatus":    result = adminUpdateStatus(params); break;
      case "deleteApp":       result = adminDeleteApp(params); break;
      case "getStats":        result = adminGetStats(params); break;
      default:
        result = { success: false, message: "Aksi tidak dikenal: " + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, message: "Server error: " + err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheet(sheet, name);
  }
  return sheet;
}

function initSheet(sheet, name) {
  const headers = {
    [SHEET.USERS]:        ["id", "nama", "email", "noHp", "jenis", "passwordHash", "poin", "createdAt"],
    [SHEET.EVENTS]:       ["id", "nama", "kategori", "deskripsi", "tanggal", "waktu", "lokasi", "kuota", "biaya", "syarat", "status", "gambar", "createdAt"],
    [SHEET.APPLICATIONS]: ["id", "userId", "eventId", "namaEvent", "kategori", "tanggalDaftar", "status", "catatan"],
    [SHEET.TRAINERS]:     ["id", "nama", "jabatan", "keahlian", "foto", "bio", "urutan"],
    [SHEET.CERTIFICATES]: ["id", "userId", "namaEvent", "eventId", "tanggal", "url"],
    [SHEET.SETTINGS]:     ["key", "value"],
  };
  if (headers[name]) {
    sheet.appendRow(headers[name]);
    sheet.getRange(1, 1, 1, headers[name].length).setFontWeight("bold");
  }
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

/* =========================================================
   AUTH
   ========================================================= */
function hashPassword(pw) {
  // Simple hash — in production gunakan proper hashing
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    const chr = pw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return "nev_" + Math.abs(hash).toString(36);
}

function handleLogin(p) {
  const { email, password } = p;
  if (!email || !password) return { success: false, message: "Email dan password wajib diisi." };

  const sheet = getSheet(SHEET.USERS);
  const users = sheetToObjects(sheet);
  const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (!user) return { success: false, message: "Email tidak terdaftar." };
  if (user.passwordHash !== hashPassword(password)) return { success: false, message: "Password salah." };

  return {
    success: true,
    user: {
      id: user.id,
      nama: user.nama,
      email: user.email,
      noHp: user.noHp,
      jenis: user.jenis,
      poin: user.poin || 0,
      role: user.jenis === "Admin" ? "admin" : "peserta",
    }
  };
}

function handleRegister(p) {
  const { nama, email, noHp, jenis, password } = p;
  if (!nama || !email || !password) return { success: false, message: "Data tidak lengkap." };
  if (password.length < 8) return { success: false, message: "Password minimal 8 karakter." };

  const sheet = getSheet(SHEET.USERS);
  const users = sheetToObjects(sheet);
  if (users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: "Email sudah terdaftar." };
  }

  const id = "USR_" + Date.now();
  sheet.appendRow([id, nama, email, noHp || "", jenis || "Umum", hashPassword(password), 0, new Date().toISOString()]);
  return { success: true, message: "Akun berhasil dibuat." };
}

function handleUpdateProfile(p) {
  const { userId, nama, noHp } = p;
  if (!userId || !nama) return { success: false, message: "Data tidak lengkap." };

  const sheet = getSheet(SHEET.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf("id");
  const namaIdx = headers.indexOf("nama");
  const noHpIdx = headers.indexOf("noHp");

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === userId || data[i][headers.indexOf("email")] === userId) {
      sheet.getRange(i + 1, namaIdx + 1).setValue(nama);
      if (noHpIdx >= 0) sheet.getRange(i + 1, noHpIdx + 1).setValue(noHp || "");
      return { success: true };
    }
  }
  return { success: false, message: "User tidak ditemukan." };
}

/* =========================================================
   EVENTS
   ========================================================= */
function handleGetEvents() {
  const sheet = getSheet(SHEET.EVENTS);
  const events = sheetToObjects(sheet);
  return events.filter(e => e.id && e.nama);
}

function handleGetTrainers() {
  const sheet = getSheet(SHEET.TRAINERS);
  const trainers = sheetToObjects(sheet);
  return trainers.filter(t => t.id && t.nama).sort((a, b) => (a.urutan || 99) - (b.urutan || 99));
}

function handleAlumniCount() {
  const sheet = getSheet(SHEET.SETTINGS);
  const settings = sheetToObjects(sheet);
  const row = settings.find(s => s.key === "alumniCount");
  return { count: row ? Number(row.value) || 0 : 0 };
}

/* =========================================================
   APPLICATIONS
   ========================================================= */
function handleDaftar(p) {
  const { userId, eventId, nama, email } = p;
  if (!userId || !eventId) return { success: false, message: "Data tidak lengkap." };

  const sheet = getSheet(SHEET.APPLICATIONS);
  const apps = sheetToObjects(sheet);
  if (apps.find(a => String(a.userId) === String(userId) && String(a.eventId) === String(eventId))) {
    return { success: false, message: "Kamu sudah mendaftar ke kegiatan ini." };
  }

  // Get event details
  const evSheet = getSheet(SHEET.EVENTS);
  const events = sheetToObjects(evSheet);
  const ev = events.find(e => String(e.id) === String(eventId) || e.nama === eventId);

  const id = "APP_" + Date.now();
  sheet.appendRow([
    id,
    userId,
    eventId,
    ev ? ev.nama : eventId,
    ev ? ev.kategori : "",
    new Date().toISOString(),
    "pending",
    "",
  ]);

  return { success: true, message: "Pendaftaran berhasil! Menunggu konfirmasi admin." };
}

function handleGetMyApplications(p) {
  const { userId } = p;
  if (!userId) return [];
  const sheet = getSheet(SHEET.APPLICATIONS);
  const apps = sheetToObjects(sheet);
  return apps.filter(a => String(a.userId) === String(userId));
}

function handleGetMyCertificates(p) {
  const { userId } = p;
  if (!userId) return [];
  const sheet = getSheet(SHEET.CERTIFICATES);
  const certs = sheetToObjects(sheet);
  return certs.filter(c => String(c.userId) === String(userId));
}

/* =========================================================
   ABSENSI
   ========================================================= */
function handleAbsen(p) {
  const { scannerUid, targetUid } = p;
  if (!scannerUid || !targetUid) return { success: false, message: "Data tidak lengkap." };

  // Cari user target
  const userSheet = getSheet(SHEET.USERS);
  const users = sheetToObjects(userSheet);
  const target = users.find(u => u.id === targetUid || u.email === targetUid);
  if (!target) return { success: false, message: "QR tidak valid." };

  // Update application status jadi "hadir"
  const appSheet = getSheet(SHEET.APPLICATIONS);
  const data = appSheet.getDataRange().getValues();
  const headers = data[0];
  const userIdIdx = headers.indexOf("userId");
  const statusIdx = headers.indexOf("status");
  let updated = false;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userIdIdx]) === String(target.id || target.email)) {
      if (/approved|disetujui/i.test(data[i][statusIdx])) {
        appSheet.getRange(i + 1, statusIdx + 1).setValue("hadir");
        updated = true;
      }
    }
  }

  if (updated) {
    return { success: true, nama: target.nama, message: "Absensi berhasil dicatat." };
  } else {
    return { success: false, message: "Tidak ada kegiatan yang disetujui untuk peserta ini." };
  }
}

/* =========================================================
   ADMIN
   ========================================================= */
function adminGetUsers(p) {
  // Tambahkan validasi admin jika perlu
  const sheet = getSheet(SHEET.USERS);
  return sheetToObjects(sheet).map(u => ({ ...u, passwordHash: undefined }));
}

function adminUpdateStatus(p) {
  const { appId, status, catatan } = p;
  if (!appId || !status) return { success: false, message: "Data tidak lengkap." };

  const sheet = getSheet(SHEET.APPLICATIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf("id");
  const statusIdx = headers.indexOf("status");
  const catatanIdx = headers.indexOf("catatan");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(appId)) {
      sheet.getRange(i + 1, statusIdx + 1).setValue(status);
      if (catatanIdx >= 0 && catatan) sheet.getRange(i + 1, catatanIdx + 1).setValue(catatan);
      return { success: true };
    }
  }
  return { success: false, message: "Pendaftaran tidak ditemukan." };
}

function adminDeleteApp(p) {
  const { appId } = p;
  if (!appId) return { success: false, message: "ID tidak ada." };

  const sheet = getSheet(SHEET.APPLICATIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf("id");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(appId)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: "Data tidak ditemukan." };
}

function adminGetStats() {
  const userCount = getSheet(SHEET.USERS).getLastRow() - 1;
  const eventCount = getSheet(SHEET.EVENTS).getLastRow() - 1;
  const appCount = getSheet(SHEET.APPLICATIONS).getLastRow() - 1;

  const appSheet = getSheet(SHEET.APPLICATIONS);
  const apps = sheetToObjects(appSheet);
  const approved = apps.filter(a => /approved|disetujui|hadir/i.test(a.status || "")).length;

  return {
    users: Math.max(userCount, 0),
    events: Math.max(eventCount, 0),
    applications: Math.max(appCount, 0),
    approved,
  };
}
