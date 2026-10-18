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

// ID database disimpan otomatis di Script Properties oleh setupEventNevDatabase().
const SPREADSHEET_ID = "GANTI_DENGAN_ID_SPREADSHEET_KAMU";

function getDatabaseSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty("EVENTNEV_SPREADSHEET_ID");
  const id = savedId || SPREADSHEET_ID;
  if (!id || id === "GANTI_DENGAN_ID_SPREADSHEET_KAMU") {
    throw new Error("Database belum dibuat. Jalankan setupEventNevDatabase() dari editor Apps Script.");
  }
  return SpreadsheetApp.openById(id);
}

/**
 * Jalankan SATU KALI setelah menempelkan Code.gs.
 * Membuat spreadsheet dan semua sheet inti EventNev.
 * URL spreadsheet akan muncul di Execution log.
 */
function setupEventNevDatabase() {
  const properties = PropertiesService.getScriptProperties();
  let ss;
  const existingId = properties.getProperty("EVENTNEV_SPREADSHEET_ID");

  if (existingId) {
    try {
      ss = SpreadsheetApp.openById(existingId);
    } catch (err) {
      // Spreadsheet lama mungkin sudah dihapus. Buat database baru.
      ss = null;
    }
  }

  if (!ss && SPREADSHEET_ID && SPREADSHEET_ID !== "GANTI_DENGAN_ID_SPREADSHEET_KAMU") {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create("EventNev Database");
  }

  properties.setProperty("EVENTNEV_SPREADSHEET_ID", ss.getId());

  const schemas = {
    Users: ["id", "nama", "email", "noHp", "jenis", "passwordHash", "poin", "createdAt"],
    Events: ["id", "nama", "kategori", "deskripsi", "tanggal", "batasPendaftaran", "sasaran", "waktu", "lokasi", "kuota", "biaya", "syarat", "persyaratanFoto", "status", "gambar", "createdAt"],
    Applications: ["id", "userId", "eventId", "namaEvent", "kategori", "tanggalDaftar", "status", "catatan", "requirementFileId", "requirementFileName"],
    Trainers: ["id", "nama", "jabatan", "keahlian", "foto", "bio", "urutan"],
    Certificates: ["id", "userId", "namaEvent", "eventId", "tanggal", "url"],
    Settings: ["key", "value"]
  };

  Object.keys(schemas).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      const headers = schemas[name];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  });

  // Hapus sheet bawaan kosong hanya jika aman dan sheet inti sudah dibuat.
  ss.getSheets().forEach(function(sheet) {
    if (sheet.getName() === "Sheet1" && sheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
    }
  });

  Logger.log("EventNev database siap: " + ss.getUrl());
  Logger.log("Spreadsheet ID: " + ss.getId());
  return ss.getUrl();
}

/**
 * Jalankan setelah setupEventNevDatabase().
 * Ganti PASSWORD_ADMIN dengan password pilihanmu sebelum menjalankan.
 * Fungsi membuat atau memperbarui akun admin awal.
 */
function buatAdminAwal() {
  const EMAIL_ADMIN = "nevpurwokerto@gmail.com";
  const PASSWORD_ADMIN = "GANTI_PASSWORD_ADMIN_MINIMAL_8_KARAKTER";
  const NAMA_ADMIN = "Administrator EventNev";

  if (PASSWORD_ADMIN === "GANTI_PASSWORD_ADMIN_MINIMAL_8_KARAKTER" || PASSWORD_ADMIN.length < 8) {
    throw new Error("Ganti PASSWORD_ADMIN dengan password minimal 8 karakter sebelum menjalankan fungsi.");
  }

  const sheet = getDatabaseSpreadsheet_().getSheetByName("Users");
  if (!sheet) throw new Error('Sheet "Users" tidak ditemukan. Jalankan setupEventNevDatabase() dahulu.');

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function(h) { return String(h).trim(); });
  const col = {
    id: headers.indexOf("id"),
    nama: headers.indexOf("nama"),
    email: headers.indexOf("email"),
    noHp: headers.indexOf("noHp"),
    jenis: headers.indexOf("jenis"),
    passwordHash: headers.indexOf("passwordHash"),
    poin: headers.indexOf("poin"),
    createdAt: headers.indexOf("createdAt")
  };
  if (col.email < 0 || col.jenis < 0 || col.passwordHash < 0) {
    throw new Error("Header Users tidak sesuai. Jalankan setupEventNevDatabase() dan periksa header.");
  }

  let rowNumber = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.email]).trim().toLowerCase() === EMAIL_ADMIN.toLowerCase()) {
      rowNumber = i + 1;
      break;
    }
  }

  let hash = 0;
  for (let i = 0; i < PASSWORD_ADMIN.length; i++) {
    const chr = PASSWORD_ADMIN.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const passwordHash = "nev_" + Math.abs(hash).toString(36);

  if (rowNumber === -1) {
    const newRow = new Array(headers.length).fill("");
    if (col.id >= 0) newRow[col.id] = "USR_ADMIN_" + Date.now();
    if (col.nama >= 0) newRow[col.nama] = NAMA_ADMIN;
    newRow[col.email] = EMAIL_ADMIN;
    if (col.noHp >= 0) newRow[col.noHp] = "";
    newRow[col.jenis] = "Admin";
    newRow[col.passwordHash] = passwordHash;
    if (col.poin >= 0) newRow[col.poin] = 0;
    if (col.createdAt >= 0) newRow[col.createdAt] = new Date().toISOString();
    sheet.appendRow(newRow);
  } else {
    if (col.nama >= 0) sheet.getRange(rowNumber, col.nama + 1).setValue(NAMA_ADMIN);
    sheet.getRange(rowNumber, col.jenis + 1).setValue("Admin");
    sheet.getRange(rowNumber, col.passwordHash + 1).setValue(passwordHash);
  }

  SpreadsheetApp.flush();
  Logger.log("Akun admin siap: " + EMAIL_ADMIN);
  return "Akun admin berhasil disiapkan. Login menggunakan password yang diisi di fungsi buatAdminAwal().";
}

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
      case "addEvent":         result = adminSaveRecord_("Events", params, "event"); break;
      case "updateEvent":      result = adminSaveRecord_("Events", params, "event"); break;
      case "addTrainer":       result = adminSaveRecord_("Trainers", params, "trainer"); break;
      case "updateTrainer":    result = adminSaveRecord_("Trainers", params, "trainer"); break;
      default:
        result = { success: false, message: "Aksi tidak dikenal: " + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, message: "Server error: " + err.message });
  }
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.action !== 'uploadRequirementPhoto') return jsonResponse({success:false,message:'Aksi tidak dikenal.'});
    const userId = String(p.userId || '').trim();
    const email = String(p.email || '').trim().toLowerCase();
    if (!userId || !email) return jsonResponse({success:false,message:'Silakan login kembali.'});
    const users = sheetToObjects(getSheet(SHEET.USERS));
    const user = users.find(u => (String(u.id || '') === userId || String(u.email || '').toLowerCase() === userId.toLowerCase()) && String(u.email || '').toLowerCase() === email);
    if (!user) return jsonResponse({success:false,message:'Akun peserta tidak valid.'});
    const eventId = String(p.eventId || '');
    const ev = sheetToObjects(getSheet(SHEET.EVENTS)).find(x => String(x.id) === eventId || String(x.nama) === eventId);
    if (!ev || !String(ev.persyaratanFoto || '').trim()) return jsonResponse({success:false,message:'Kegiatan ini tidak meminta foto persyaratan.'});
    const mime = String(p.mimeType || '');
    if (['image/jpeg','image/png','image/webp'].indexOf(mime) < 0) return jsonResponse({success:false,message:'Format harus JPG, PNG, atau WEBP.'});
    const b64 = String(p.base64 || '');
    if (!b64 || b64.length > 1400000) return jsonResponse({success:false,message:'Foto harus di bawah 1 MB setelah kompresi.'});
    const bytes = Utilities.base64Decode(b64);
    if (bytes.length >= 1048576) return jsonResponse({success:false,message:'Foto harus di bawah 1 MB.'});
    const props = PropertiesService.getScriptProperties();
    let folder = null;
    const savedId = props.getProperty('EVENTNEV_REQUIREMENT_FOLDER_ID');
    if (savedId) { try { folder = DriveApp.getFolderById(savedId); } catch (ignore) {} }
    if (!folder) { folder = DriveApp.createFolder('EventNev - Foto Persyaratan Peserta'); props.setProperty('EVENTNEV_REQUIREMENT_FOLDER_ID', folder.getId()); }
    const name = String(p.fileName || 'foto-persyaratan.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0,100);
    const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
    return jsonResponse({success:true,fileId:file.getId(),fileName:name,message:'Foto berhasil diunggah.'});
  } catch (err) { return jsonResponse({success:false,message:'Upload gagal: ' + err.message}); }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = getDatabaseSpreadsheet_();
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
  const { userId, eventId, nama, email, requirementFileId, requirementFileName } = p;
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
  if (ev && String(ev.persyaratanFoto || "").trim() && !requirementFileId) {
    return { success: false, message: "Foto persyaratan wajib diunggah sebelum mendaftar." };
  }

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
    requirementFileId || "",
    requirementFileName || "",
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


/* =========================================================
   ADMIN EDITOR — EVENT & TRAINER
   ========================================================= */
function adminSaveRecord_(sheetName, p, type) {
  // Pastikan pemanggil menyatakan email admin yang terdaftar.
  // Catatan: untuk keamanan produksi, endpoint perlu session token server-side.
  const email = String(p.adminEmail || "").trim().toLowerCase();
  if (!email) return { success: false, message: "Sesi admin tidak ditemukan. Keluar lalu login kembali." };

  const users = sheetToObjects(getSheet(SHEET.USERS));
  const admin = users.find(u => String(u.email || "").trim().toLowerCase() === email);
  if (!admin || String(admin.jenis || "").trim() !== "Admin") {
    return { success: false, message: "Akses ditolak. Hanya admin yang dapat menyimpan data." };
  }

  const isEvent = type === "event";
  const fields = isEvent
    ? ["nama","kategori","deskripsi","tanggal","batasPendaftaran","sasaran","waktu","lokasi","kuota","biaya","syarat","persyaratanFoto","status","gambar"]
    : ["nama","jabatan","keahlian","foto","bio","urutan"];

  if (!String(p.nama || "").trim()) return { success: false, message: "Nama wajib diisi." };
  if (isEvent && (!String(p.kategori || "").trim() || !String(p.tanggal || "").trim())) {
    return { success: false, message: "Kategori dan tanggal event wajib diisi." };
  }
  if (!isEvent && (!String(p.jabatan || "").trim() || !String(p.keahlian || "").trim())) {
    return { success: false, message: "Jabatan dan keahlian trainer wajib diisi." };
  }

  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  let rowNumber = -1;
  const recordId = String(p.id || "").trim();

  if (recordId) {
    const idCol = headers.indexOf("id");
    if (idCol < 0) return { success: false, message: "Kolom id tidak ditemukan." };
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === recordId) { rowNumber = i + 1; break; }
    }
    if (rowNumber < 0) return { success: false, message: "Data yang akan diedit tidak ditemukan." };
  }

  const record = {};
  record.id = recordId || (isEvent ? "EVT_" : "TRN_") + Date.now();
  fields.forEach(key => {
    let value = p[key] == null ? "" : String(p[key]).trim();
    if (["kuota","biaya","urutan"].includes(key) && value !== "") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error("Nilai " + key + " harus berupa angka positif.");
      value = n;
    }
    record[key] = value;
  });
  if (isEvent && !record.status) record.status = "Buka";
  if (!isEvent && !record.urutan) record.urutan = 1;

  if (rowNumber < 0) {
    const newRow = headers.map(h => h === "createdAt" ? new Date().toISOString() : (record[h] !== undefined ? record[h] : ""));
    sheet.appendRow(newRow);
  } else {
    headers.forEach((h, index) => {
      if (record[h] !== undefined) sheet.getRange(rowNumber, index + 1).setValue(record[h]);
    });
  }
  return { success: true, id: record.id, message: "Data berhasil disimpan." };
}
