/**
 * Jalankan fungsi ini sekali dari editor Apps Script untuk memicu otorisasi Google Drive.
 * Setelah izin diberikan, upload gambar melalui Web App dapat membuat folder penyimpanan.
 */
function authorizeEventNevDrive() {
  const folderName = 'EventNev - Gambar Event dan Trainer';
  const props = PropertiesService.getScriptProperties();
  const key = 'EVENTNEV_PUBLIC_IMAGES_FOLDER_ID';
  let folder = null;
  const savedId = props.getProperty(key);
  if (savedId) {
    try { folder = DriveApp.getFolderById(savedId); } catch (ignore) {}
  }
  if (!folder) {
    folder = DriveApp.createFolder(folderName);
    props.setProperty(key, folder.getId());
  }
  Logger.log('Otorisasi Drive siap. Folder ID: ' + folder.getId());
  return folder.getId();
}

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

  const passwordHash = hashPassword(PASSWORD_ADMIN);

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
  const params = (e && e.parameter) || {};
  const action = String(params.action || "");
  const protectedActions = ["login","register","updateProfile","daftar","getMyApplications","cancelApplication","getMyCertificates","absen","getAllApplications","getCertificates","getUsers","updateStatus","deleteApp","getStats","addEvent","updateEvent","deleteEvent","addTrainer","updateTrainer","deleteTrainer"];
  if (protectedActions.indexOf(action) >= 0) return jsonResponse({success:false,message:"Aksi ini wajib menggunakan POST. Silakan muat ulang halaman."});
  try {
    let result;
    switch (action) {
      case "getEvents": result = handleGetEvents(params); break;
      case "getTrainers": result = handleGetTrainers(params); break;
      case "getAlumniCount": result = handleAlumniCount(params); break;
      default: result = {success:false,message:"Aksi tidak dikenal: " + action};
    }
    return jsonResponse(result);
  } catch (err) { return jsonResponse({success:false,message:"Server error: " + err.message}); }
}
function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(p.action || "");
    if (action === "login") return jsonResponse(handleLogin(p));
    if (action === "register") return jsonResponse(handleRegister(p));
    if (action === "logout") { revokeEventNevSession_(p.sessionToken); return jsonResponse({success:true}); }
    if (action === "getPrivateFile") return jsonResponse(handlePrivateFileRequest_(p));
    if (action === "uploadCertificate" || action === "uploadAdminImage") {
      const adminAuth = requireEventNevAdmin_(p);
      if (!adminAuth.success) return jsonResponse(adminAuth);
      p.adminEmail = adminAuth.user.email;
      if (action === "uploadCertificate") {
        const certificateResult = adminUploadCertificate_(p);
        if (certificateResult && certificateResult.success) eventNevAuditLog_(p.adminEmail, "certificate_uploaded", String(p.eventId || ""), "Sertifikat diunggah untuk peserta " + String(p.userId || ""));
        return jsonResponse(certificateResult);
      }
      if (["event","trainer"].indexOf(String(p.kind || "")) < 0) return jsonResponse({success:false,message:"Jenis gambar tidak valid."});
      const mime = String(p.mimeType || "");
      if (["image/jpeg","image/png","image/webp"].indexOf(mime) < 0) return jsonResponse({success:false,message:"Gunakan gambar JPG, PNG, atau WEBP."});
      const b64 = String(p.base64 || "");
      if (!b64 || b64.length > 7000000) return jsonResponse({success:false,message:"Ukuran gambar terlalu besar."});
      const bytes = Utilities.base64Decode(b64);
      if (bytes.length > 5 * 1024 * 1024) return jsonResponse({success:false,message:"Ukuran gambar maksimal 5 MB."});
      if (!eventNevFileMatchesMime_(bytes, mime)) return jsonResponse({success:false,message:"Isi file tidak sesuai dengan format gambar yang dipilih."});
      const props = PropertiesService.getScriptProperties();
      const folderKey = "EVENTNEV_PUBLIC_IMAGES_FOLDER_ID";
      let folder = null;
      const folderId = props.getProperty(folderKey);
      if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (ignore) {} }
      if (!folder) { folder = DriveApp.createFolder("EventNev - Gambar Event dan Trainer"); props.setProperty(folderKey, folder.getId()); }
      const cleanName = String(p.fileName || "eventnev-image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0,100);
      const file = folder.createFile(Utilities.newBlob(bytes, mime, cleanName));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      eventNevAuditLog_(p.adminEmail, "image_uploaded", String(p.kind || ""), "Gambar admin diunggah: " + cleanName);
      return jsonResponse({success:true,url:"https://drive.google.com/uc?export=view&id="+file.getId(),fileId:file.getId(),message:"Gambar berhasil diunggah."});
    }
    if (action === "uploadRequirementPhoto") {
      const userAuth = requireEventNevParticipant_(p);
      if (!userAuth.success) return jsonResponse(userAuth);
      p.userId = userAuth.user.id; p.email = userAuth.user.email;
      const ev = sheetToObjects(getSheet(SHEET.EVENTS)).find(x => String(x.id) === String(p.eventId) || String(x.nama) === String(p.eventId));
      if (!ev || !String(ev.persyaratanFoto || "").trim()) return jsonResponse({success:false,message:"Kegiatan ini tidak meminta foto persyaratan."});
      const mime = String(p.mimeType || "");
      if (["image/jpeg","image/png","image/webp"].indexOf(mime) < 0) return jsonResponse({success:false,message:"Format harus JPG, PNG, atau WEBP."});
      const b64 = String(p.base64 || "");
      if (!b64 || b64.length > 1400000) return jsonResponse({success:false,message:"Foto harus di bawah 1 MB setelah kompresi."});
      const bytes = Utilities.base64Decode(b64);
      if (bytes.length >= 1048576) return jsonResponse({success:false,message:"Foto harus di bawah 1 MB."});
      if (!eventNevFileMatchesMime_(bytes, mime)) return jsonResponse({success:false,message:"Isi file tidak sesuai dengan format foto yang dipilih."});
      const props = PropertiesService.getScriptProperties(); let folder = null;
      const savedId = props.getProperty("EVENTNEV_PRIVATE_REQUIREMENT_FOLDER_ID");
      if (savedId) { try { folder = DriveApp.getFolderById(savedId); } catch (ignore) {} }
      if (!folder) { folder = DriveApp.createFolder("EventNev - Foto Persyaratan Peserta"); props.setProperty("EVENTNEV_PRIVATE_REQUIREMENT_FOLDER_ID", folder.getId()); }
      const name = String(p.fileName || "foto-persyaratan.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0,100);
      const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
      file.setDescription("EventNevRequirement:v1;userId=" + String(userAuth.user.id || "") + ";eventId=" + String(ev.id || ""));
      return jsonResponse({success:true,fileId:file.getId(),fileName:name,message:"Foto berhasil diunggah."});
    }
    const adminActions = ["getAllApplications","getCertificates","getUsers","updateStatus","deleteApp","getStats","getAuditLog","addEvent","updateEvent","deleteEvent","addTrainer","updateTrainer","deleteTrainer"];
    const participantActions = ["updateProfile","daftar","getMyApplications","cancelApplication","getMyCertificates"];
    if (adminActions.indexOf(action) >= 0) { const auth = requireEventNevAdmin_(p); if (!auth.success) return jsonResponse(auth); p.adminEmail = auth.user.email; }
    if (participantActions.indexOf(action) >= 0) { const auth = requireEventNevParticipant_(p); if (!auth.success) return jsonResponse(auth); p.userId = auth.user.id; p.email = auth.user.email; }
    if (action === "absen") { const auth = requireEventNevAdmin_(p); if (!auth.success) return jsonResponse(auth); p.scannerUid = auth.user.id; p.adminEmail = auth.user.email; }
    let result;
    switch (action) {
      case "updateProfile": result = handleUpdateProfile(p); break;
      case "getEvents": result = handleGetEvents(p); break;
      case "getTrainers": result = handleGetTrainers(p); break;
      case "getAlumniCount": result = handleAlumniCount(p); break;
      case "daftar": result = handleDaftar(p); break;
      case "getMyApplications": result = handleGetMyApplications(p); break;
      case "cancelApplication": result = handleCancelApplication(p); break;
      case "getMyCertificates": result = handleGetMyCertificates(p); break;
      case "absen": result = handleAbsen(p); if (result && result.success) eventNevAuditLog_(p.adminEmail, "attendance", p.eventId || "", "Presensi dicatat untuk peserta " + String(p.targetUid || "")); break;
      case "getAllApplications": result = adminGetAllApplications(p); break;
      case "getCertificates": result = adminGetCertificates_(p); break;
      case "getUsers": result = adminGetUsers(p); break;
      case "updateStatus": result = adminUpdateStatus(p); break;
      case "deleteApp": result = adminDeleteApp(p); break;
      case "getStats": result = adminGetStats(p); break;
      case "getAuditLog": result = adminGetAuditLog_(p); break;
      case "addEvent": result = adminSaveRecord_("Events", p, "event"); break;
      case "updateEvent": result = adminSaveRecord_("Events", p, "event"); break;
      case "deleteEvent": result = adminDeleteEvent_(p); break;
      case "addTrainer": result = adminSaveRecord_("Trainers", p, "trainer"); break;
      case "updateTrainer": result = adminSaveRecord_("Trainers", p, "trainer"); break;
      case "deleteTrainer": result = adminDeleteTrainer_(p); break;
      default: result = {success:false,message:"Aksi tidak dikenal: " + action};
    }
    return jsonResponse(result);
  } catch (err) { return jsonResponse({success:false,message:"Permintaan gagal: " + err.message}); }
}

function eventNevValidateRequirementUpload_(fileId, userId, eventId) {
  const id = String(fileId || "").trim();
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(id)) return false;
  try {
    const file = DriveApp.getFileById(id);
    const description = String(file.getDescription() || "");
    const expected = "EventNevRequirement:v1;userId=" + String(userId || "") + ";eventId=" + String(eventId || "");
    return description === expected;
  } catch (err) {
    return false;
  }
}
function eventNevExtractDriveFileId_(value) {
  const match = String(value || "").match(/([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : "";
}

/** Mengirim dokumen hanya jika tercatat pada sertifikat atau pendaftaran. */
function handlePrivateFileRequest_(p) {
  const sessionUser = getEventNevSession_(p);
  if (!sessionUser) return { success:false, message:"Sesi tidak valid atau kedaluwarsa. Silakan login kembali." };
  const fileId = String(p.fileId || "").trim();
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(fileId)) return { success:false, message:"Identitas file tidak valid." };
  const isAdmin = sessionUser.role === "admin";
  const userKeys = [String(sessionUser.id || "").trim().toLowerCase(), String(sessionUser.email || "").trim().toLowerCase()].filter(Boolean);
  const certs = sheetToObjects(getSheet(SHEET.CERTIFICATES));
  const apps = sheetToObjects(getSheet(SHEET.APPLICATIONS));
  const certificateMatch = certs.some(function(cert) {
    const storedUser = String(cert.userId || "").trim().toLowerCase();
    return eventNevExtractDriveFileId_(cert.url) === fileId && (isAdmin || userKeys.indexOf(storedUser) >= 0);
  });
  const requirementMatch = apps.some(function(app) {
    const storedUser = String(app.userId || "").trim().toLowerCase();
    if (String(app.requirementFileId || "").trim() !== fileId || (!isAdmin && userKeys.indexOf(storedUser) < 0)) return false;
    return eventNevValidateRequirementUpload_(fileId, String(app.userId || "").trim(), String(app.eventId || "").trim());
  });
  if (!certificateMatch && !requirementMatch) return { success:false, message:"Akses dokumen ditolak." };
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > 6 * 1024 * 1024) return { success:false, message:"File terlalu besar untuk diunduh melalui portal. Hubungi Admin." };
    return { success:true, fileName:String(file.getName() || "dokumen-eventnev").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0,120), mimeType:String(blob.getContentType() || "application/octet-stream"), base64:Utilities.base64Encode(bytes) };
  } catch (err) {
    return { success:false, message:"Dokumen tidak tersedia atau tidak dapat diakses." };
  }
}

function eventNevDigestHex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(function(b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
}
function createEventNevSession_(user) {
  const token = Utilities.getUuid().replace(/-/g,"") + Utilities.getUuid().replace(/-/g,"");
  const session = {userId:String(user.id),email:String(user.email).toLowerCase()};
  CacheService.getScriptCache().put("EVENTNEV_SESSION_" + eventNevDigestHex_(token), JSON.stringify(session), 21600);
  return token;
}
function getEventNevSession_(p) {
  const token = String((p && p.sessionToken) || ""); if (token.length < 40) return null;
  const raw = CacheService.getScriptCache().get("EVENTNEV_SESSION_" + eventNevDigestHex_(token)); if (!raw) return null;
  let saved; try { saved = JSON.parse(raw); } catch (ignore) { return null; }
  const user = sheetToObjects(getSheet(SHEET.USERS)).find(u => String(u.id) === saved.userId && String(u.email || "").toLowerCase() === saved.email);
  if (!user) return null;
  return {id:user.id,nama:user.nama,email:user.email,noHp:user.noHp,jenis:user.jenis,poin:user.poin||0,role:String(user.jenis||"").toLowerCase()==="admin"?"admin":"peserta"};
}
function requireEventNevAdmin_(p) { const user = getEventNevSession_(p); return user && user.role === "admin" ? {success:true,user:user} : {success:false,message:"Sesi admin tidak valid atau kedaluwarsa. Silakan login kembali."}; }
function requireEventNevParticipant_(p) { const user = getEventNevSession_(p); return user && user.role !== "admin" ? {success:true,user:user} : {success:false,message:"Sesi peserta tidak valid atau kedaluwarsa. Silakan login kembali."}; }
function revokeEventNevSession_(token) { if (token) CacheService.getScriptCache().remove("EVENTNEV_SESSION_" + eventNevDigestHex_(token)); }
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
function legacyHashPassword_(pw) {
  let hash = 0;
  for (let i = 0; i < String(pw).length; i++) {
    const chr = String(pw).charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return "nev_" + Math.abs(hash).toString(36);
}
function passwordDigestHex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(function(b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join("");
}
function hashPassword(pw, salt) {
  const rounds = 12000;
  const saltValue = salt || (Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""));
  let digest = passwordDigestHex_(saltValue + ":" + String(pw));
  for (let i = 1; i < rounds; i++) digest = passwordDigestHex_(saltValue + ":" + i + ":" + digest);
  return "nev2$" + rounds + "$" + saltValue + "$" + digest;
}
function verifyPassword_(pw, savedHash) {
  const stored = String(savedHash || "");
  if (stored.indexOf("nev2$") === 0) {
    const parts = stored.split("$");
    if (parts.length !== 4 || Number(parts[1]) !== 12000) return false;
    return hashPassword(pw, parts[2]) === stored;
  }
  return stored === legacyHashPassword_(pw);
}

function handleLogin(p) {
  const { email, password } = p;
  if (!email || !password) return { success: false, message: "Email dan password wajib diisi." };

  const sheet = getSheet(SHEET.USERS);
  const users = sheetToObjects(sheet);
  const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (!user) return { success: false, message: "Email atau password tidak valid." };
  if (!verifyPassword_(password, user.passwordHash)) return { success: false, message: "Email atau password tidak valid." };

  // Upgrade legacy hashes only after a successful login; no schema or data reset is needed.
  if (String(user.passwordHash || "").indexOf("nev2$") !== 0) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function(h) { return String(h).trim(); });
    const emailCol = headers.indexOf("email");
    const hashCol = headers.indexOf("passwordHash");
    for (let i = 1; i < data.length; i++) {
      if (emailCol >= 0 && hashCol >= 0 && String(data[i][emailCol]).toLowerCase() === String(user.email).toLowerCase()) {
        sheet.getRange(i + 1, hashCol + 1).setValue(hashPassword(password));
        break;
      }
    }
  }

  const safeUser = {
    id: user.id, nama: user.nama, email: user.email, noHp: user.noHp,
    jenis: user.jenis, poin: user.poin || 0,
    role: String(user.jenis || "").toLowerCase() === "admin" ? "admin" : "peserta"
  };
  return { success: true, user: safeUser, sessionToken: createEventNevSession_(user) };
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
  const userId = String(p.userId || "").trim();
  const nama = String(p.nama || "").trim().replace(/\\s+/g, " ");
  const noHp = String(p.noHp || "").trim();
  if (!userId || !nama) return { success: false, message: "Nama lengkap wajib diisi." };
  if (nama.length > 120) return { success: false, message: "Nama maksimal 120 karakter." };
  if (noHp.length > 30) return { success: false, message: "Nomor HP maksimal 30 karakter." };
  if (/[<>]/.test(nama)) return { success: false, message: "Nama mengandung karakter yang tidak diperbolehkan." };

  const sheet = getSheet(SHEET.USERS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: false, message: "Akun tidak ditemukan." };
  const headers = data[0].map(h => String(h).trim());
  const idIdx = headers.indexOf("id"), emailIdx = headers.indexOf("email");
  const namaIdx = headers.indexOf("nama"), noHpIdx = headers.indexOf("noHp");
  if (namaIdx < 0 || (idIdx < 0 && emailIdx < 0)) return { success: false, message: "Kolom profil tidak lengkap." };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Profil sedang diperbarui. Coba kembali." };
  try {
    for (let i = 1; i < data.length; i++) {
      const matchesId = idIdx >= 0 && String(data[i][idIdx] || "") === userId;
      const matchesEmail = emailIdx >= 0 && String(data[i][emailIdx] || "").toLowerCase() === userId.toLowerCase();
      if (!matchesId && !matchesEmail) continue;
      sheet.getRange(i + 1, namaIdx + 1).setValue(nama);
      if (noHpIdx >= 0) sheet.getRange(i + 1, noHpIdx + 1).setValue(noHp);
      SpreadsheetApp.flush();
      return { success: true, message: "Profil berhasil diperbarui.", nama: nama, noHp: noHp };
    }
    return { success: false, message: "Akun tidak ditemukan." };
  } finally {
    lock.releaseLock();
  }
}
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
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Sistem sedang memproses pendaftaran lain. Coba kembali." };
  try {
  const sheet = getSheet(SHEET.APPLICATIONS);
  eventNevEnsureHeaders_(sheet, ["requirementFileId", "requirementFileName"]);
  const apps = sheetToObjects(sheet);
  const evSheet = getSheet(SHEET.EVENTS);
  const events = sheetToObjects(evSheet);
  const ev = events.find(e => String(e.id) === String(eventId) || String(e.nama) === String(eventId));
  if (!ev) return { success: false, message: "Kegiatan tidak ditemukan atau sudah tidak tersedia." };

  // Kompatibilitas data lama: pendaftaran mungkin menyimpan email atau nama event,
  // sedangkan sesi dan event terbaru menggunakan ID kanonis.
  const userKeys = [String(userId || "").trim().toLowerCase(), String(p.email || email || "").trim().toLowerCase()].filter(Boolean);
  const eventKeys = [String(eventId || "").trim().toLowerCase(), String(ev.id || "").trim().toLowerCase(), String(ev.nama || "").trim().toLowerCase()].filter(Boolean);
  const matchingRegistrations = apps.filter(a =>
    userKeys.indexOf(String(a.userId || "").trim().toLowerCase()) >= 0 &&
    eventKeys.indexOf(String(a.eventId || "").trim().toLowerCase()) >= 0
  );
  const existing = matchingRegistrations.find(a =>
    !["cancelled", "dibatalkan"].includes(String(a.status || "pending").trim().toLowerCase())
  ) || matchingRegistrations[0];
  if (existing) {
    const oldStatus = String(existing.status || "pending").trim().toLowerCase();
    if (!["cancelled", "dibatalkan"].includes(oldStatus)) return { success: false, message: "Kamu sudah mendaftar ke kegiatan ini." };
  }
  const eventStatus = String(ev.status || "").trim().toLowerCase();
  if (["tutup","ditutup","closed","close","nonaktif","tidak aktif","draft","penuh"].indexOf(eventStatus) >= 0) {
    return { success: false, message: "Pendaftaran kegiatan ini sudah ditutup." };
  }
  const deadline = String(ev.batasPendaftaran || ev.tanggalTutup || "").trim();
  if (deadline && /^\d{4}-\d{2}-\d{2}/.test(deadline)) {
    const today = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
    if (today > deadline.slice(0, 10)) return { success: false, message: "Masa pendaftaran kegiatan ini sudah berakhir." };
  }
  const capacity = Number(ev.kuota || 0);
  if (Number.isFinite(capacity) && capacity > 0) {
    const occupied = apps.filter(a =>
      eventKeys.indexOf(String(a.eventId || "").trim().toLowerCase()) >= 0 &&
      !["cancelled","dibatalkan","rejected","ditolak"].includes(String(a.status || "pending").trim().toLowerCase())
    ).length;
    const existingStatus = String(existing && existing.status || "").trim().toLowerCase();
    const alreadyCounted = existing && !["cancelled","dibatalkan","rejected","ditolak"].includes(existingStatus);
    if (!alreadyCounted && occupied >= capacity) return { success: false, message: "Kuota kegiatan sudah penuh." };
  }
  if (String(ev.persyaratanFoto || "").trim() && !requirementFileId) {
    return { success: false, message: "Foto persyaratan wajib diunggah sebelum mendaftar." };
  }
  if (requirementFileId && !eventNevValidateRequirementUpload_(requirementFileId, userId, ev.id)) {
    return { success: false, message: "Foto persyaratan tidak valid atau bukan milik akun ini untuk kegiatan tersebut. Unggah ulang foto persyaratan." };
  }
  if (existing && ["cancelled", "dibatalkan"].includes(String(existing.status || "").trim().toLowerCase())) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const row = apps.findIndex(a => String(a.id) === String(existing.id)) + 2;
    if (row < 2) return { success: false, message: "Data pendaftaran lama tidak ditemukan." };
    const values = {
      namaEvent: ev ? ev.nama : (existing.namaEvent || eventId),
      kategori: ev ? ev.kategori : (existing.kategori || ""),
      tanggalDaftar: new Date().toISOString(),
      status: "pending",
      catatan: "",
      requirementFileId: requirementFileId || "",
      requirementFileName: requirementFileName || ""
    };
    Object.keys(values).forEach(key => { const col = headers.indexOf(key); if (col >= 0) sheet.getRange(row, col + 1).setValue(values[key]); });
    SpreadsheetApp.flush();
    return { success: true, message: "Pendaftaran berhasil dibuat kembali! Menunggu konfirmasi admin." };
  }
  const id = "APP_" + Date.now();
  const record = {id:id,userId:userId,eventId:String(ev.id || eventId),namaEvent:ev.nama || eventId,kategori:ev.kategori || "",tanggalDaftar:new Date().toISOString(),status:"pending",catatan:"",requirementFileId:requirementFileId || "",requirementFileName:requirementFileName || ""};
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  sheet.appendRow(headers.map(h => record[h] !== undefined ? record[h] : ""));
  return { success: true, message: "Pendaftaran berhasil! Menunggu konfirmasi admin." };
  } finally {
    lock.releaseLock();
  }
}

function handleCancelApplication(p) {
  const userId = String(p.userId || "").trim();
  const email = String(p.email || "").trim().toLowerCase();
  const applicationId = String(p.applicationId || "").trim();
  if ((!userId && !email) || !applicationId) return { success: false, message: "Data pembatalan tidak lengkap." };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Sistem sedang memproses perubahan lain. Coba kembali." };
  try {
    const sheet = getSheet(SHEET.APPLICATIONS);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { success: false, message: "Pendaftaran tidak ditemukan." };
    const headers = values[0].map(h => String(h).trim());
    const idCol = headers.indexOf("id"), userCol = headers.indexOf("userId"), statusCol = headers.indexOf("status");
    if (idCol < 0 || userCol < 0 || statusCol < 0) throw new Error("Kolom Applications tidak lengkap.");
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) !== applicationId) continue;
      const storedUser = String(values[i][userCol] || "").trim();
      const ownsApplication = (userId && storedUser === userId) || (email && storedUser.toLowerCase() === email);
      if (!ownsApplication) return { success: false, message: "Kamu tidak berhak membatalkan pendaftaran ini." };
      const status = String(values[i][statusCol] || "pending").trim().toLowerCase();
      if (status === "cancelled" || status === "dibatalkan") return { success: false, message: "Pendaftaran ini sudah dibatalkan." };
      if (status !== "pending" && status !== "menunggu") return { success: false, message: "Pendaftaran hanya dapat dibatalkan saat masih menunggu konfirmasi." };
      sheet.getRange(i + 1, statusCol + 1).setValue("cancelled");
      SpreadsheetApp.flush();
      return { success: true, message: "Pendaftaran berhasil dibatalkan." };
    }
    return { success: false, message: "Pendaftaran tidak ditemukan." };
  } finally {
    lock.releaseLock();
  }
}

function handleGetMyApplications(p) {
  const userId = String(p.userId || "").trim();
  const email = String(p.email || "").trim().toLowerCase();
  if (!userId && !email) return [];
  const apps = sheetToObjects(getSheet(SHEET.APPLICATIONS));
  return apps.filter(app => {
    const storedId = String(app.userId || "").trim();
    return (userId && storedId === userId) || (email && storedId.toLowerCase() === email);
  });
}

function handleGetMyCertificates(p) {
  const userId = String(p.userId || "").trim();
  const email = String(p.email || "").trim().toLowerCase();
  if (!userId && !email) return [];
  const certs = sheetToObjects(getSheet(SHEET.CERTIFICATES));
  return certs.filter(cert => {
    const storedId = String(cert.userId || "").trim();
    return (userId && storedId === userId) || (email && storedId.toLowerCase() === email);
  });
}

/* =========================================================
   ABSENSI
   ========================================================= */
function handleAbsen(p) {
  const targetUid = String(p.targetUid || "").trim();
  const eventId = String(p.eventId || "").trim();
  if (!targetUid || !eventId) return { success: false, message: "Pilih kegiatan dan pastikan QR peserta valid." };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Sistem sedang memproses presensi lain. Coba kembali." };
  try {
    const users = sheetToObjects(getSheet(SHEET.USERS));
    const target = users.find(u => String(u.id || "") === targetUid || String(u.email || "").toLowerCase() === targetUid.toLowerCase());
    if (!target) return { success: false, message: "QR peserta tidak valid." };

    const event = sheetToObjects(getSheet(SHEET.EVENTS)).find(e => String(e.id || "") === eventId);
    if (!event) return { success: false, message: "Kegiatan tidak ditemukan. Muat ulang daftar kegiatan." };

    const appSheet = getSheet(SHEET.APPLICATIONS);
    const data = appSheet.getDataRange().getValues();
    if (data.length < 2) return { success: false, message: "Belum ada pendaftaran untuk kegiatan ini." };
    const headers = data[0].map(h => String(h).trim());
    const userIdIdx = headers.indexOf("userId");
    const eventIdIdx = headers.indexOf("eventId");
    const statusIdx = headers.indexOf("status");
    if (userIdIdx < 0 || eventIdIdx < 0 || statusIdx < 0) throw new Error("Kolom Applications tidak lengkap.");

    for (let i = 1; i < data.length; i++) {
      const applicationUserId = String(data[i][userIdIdx] || "").trim().toLowerCase();
      const sameUser = applicationUserId === String(target.id || "").trim().toLowerCase() || applicationUserId === String(target.email || "").trim().toLowerCase();
      const sameEvent = String(data[i][eventIdIdx] || "") === eventId;
      if (!sameUser || !sameEvent) continue;

      const status = String(data[i][statusIdx] || "").trim().toLowerCase();
      if (status === "hadir") return { success: false, message: "Presensi peserta ini sudah tercatat untuk kegiatan tersebut." };
      if (!/^(approved|disetujui)$/i.test(status)) {
        return { success: false, message: "Peserta belum disetujui untuk kegiatan ini." };
      }

      appSheet.getRange(i + 1, statusIdx + 1).setValue("hadir");
      SpreadsheetApp.flush();
      return { success: true, nama: target.nama, namaEvent: event.nama, message: "Presensi berhasil dicatat." };
    }
    return { success: false, message: "Peserta tidak terdaftar pada kegiatan yang dipilih." };
  } finally {
    lock.releaseLock();
  }
}
/* =========================================================
   ADMIN
   ========================================================= */

function isEventNevAdmin_(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return sheetToObjects(getSheet(SHEET.USERS)).some(u =>
    String(u.email || "").trim().toLowerCase() === normalized &&
    String(u.jenis || "").trim().toLowerCase() === "admin"
  );
}

function adminGetCertificates_(p) {
  if (!isEventNevAdmin_(p.adminEmail)) return { success: false, message: "Akses ditolak. Hanya admin yang dapat melihat sertifikat." };
  return sheetToObjects(getSheet(SHEET.CERTIFICATES)).filter(c => c.id);
}

function eventNevFileMatchesMime_(bytes, mime) {
  if (!bytes || !bytes.length) return false;
  const b = bytes.map(value => value & 255);
  if (mime === "application/pdf") return b.length >= 5 && b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70 && b[4] === 45;
  if (mime === "image/jpeg") return b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (mime === "image/png") return b.length >= 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10;
  if (mime === "image/gif") return b.length >= 6 && b[0] === 71 && b[1] === 73 && b[2] === 70 && b[3] === 56 && (b[4] === 55 || b[4] === 57) && b[5] === 97;
  if (mime === "image/webp") return b.length >= 12 && b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80;
  return false;
}

function adminUploadCertificate_(p) {
  const email = String(p.adminEmail || "").trim().toLowerCase();
  if (!isEventNevAdmin_(email)) return { success: false, message: "Akses upload hanya untuk admin." };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Sistem sedang memproses sertifikat lain. Coba kembali." };
  try {

  const userId = String(p.userId || "").trim();
  const eventId = String(p.eventId || "").trim();
  const eventName = String(p.namaEvent || "").trim();
  if (!userId || !eventName) return { success: false, message: "Pilih peserta dan isi nama kegiatan/sertifikat." };

  const users = sheetToObjects(getSheet(SHEET.USERS));
  const user = users.find(u => String(u.id || "") === userId);
  if (!user) return { success: false, message: "Peserta tidak ditemukan. Muat ulang daftar peserta." };
  if (!eventId) return { success: false, message: "Pilih kegiatan terkait sertifikat." };
  const event = sheetToObjects(getSheet(SHEET.EVENTS)).find(ev => String(ev.id || "") === eventId);
  if (!event) return { success: false, message: "Kegiatan terkait sertifikat tidak ditemukan." };

  const applications = sheetToObjects(getSheet(SHEET.APPLICATIONS));
  const userKeys = [String(user.id || "").trim().toLowerCase(), String(user.email || "").trim().toLowerCase()];
  const eventKeys = [String(event.id || "").trim().toLowerCase(), String(event.nama || "").trim().toLowerCase()];
  const attended = applications.some(a =>
    userKeys.indexOf(String(a.userId || "").trim().toLowerCase()) >= 0 &&
    eventKeys.indexOf(String(a.eventId || "").trim().toLowerCase()) >= 0 &&
    String(a.status || "").trim().toLowerCase() === "hadir"
  );
  if (!attended) return { success: false, message: "Sertifikat hanya dapat diberikan kepada peserta yang tercatat Hadir pada kegiatan tersebut." };

  const existingCertificate = sheetToObjects(getSheet(SHEET.CERTIFICATES)).some(c =>
    userKeys.indexOf(String(c.userId || "").trim().toLowerCase()) >= 0 &&
    eventKeys.indexOf(String(c.eventId || "").trim().toLowerCase()) >= 0
  );
  if (existingCertificate) return { success: false, message: "Peserta ini sudah memiliki sertifikat untuk kegiatan tersebut." };

  const mime = String(p.mimeType || "").toLowerCase();
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  if (allowedMime.indexOf(mime) < 0) return { success: false, message: "Format tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau PDF." };

  const b64 = String(p.base64 || "");
  if (!b64 || b64.length > 9500000) return { success: false, message: "File kosong atau terlalu besar. Maksimal 6 MB." };
  const bytes = Utilities.base64Decode(b64);
  if (bytes.length > 6 * 1024 * 1024) return { success: false, message: "Ukuran file maksimal 6 MB." };
  if (!eventNevFileMatchesMime_(bytes, mime)) return { success: false, message: "Isi file tidak sesuai dengan format yang dipilih. Unggah file yang valid." };

  const props = PropertiesService.getScriptProperties();
  const folderKey = "EVENTNEV_PRIVATE_CERTIFICATES_FOLDER_ID";
  let folder = null;
  const savedId = props.getProperty(folderKey);
  if (savedId) { try { folder = DriveApp.getFolderById(savedId); } catch (ignore) {} }
  if (!folder) {
    folder = DriveApp.createFolder("EventNev - Sertifikat Peserta");
    props.setProperty(folderKey, folder.getId());
  }

  const cleanName = String(p.fileName || "sertifikat").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, cleanName));
  // Sertifikat baru tetap privat di Drive dan hanya disajikan melalui endpoint terautentikasi.
  // File lama yang pernah dibagikan publik perlu remediasi terpisah.
  const url = "eventnev-private://" + file.getId();

  const sheet = getSheet(SHEET.CERTIFICATES);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const record = {
    id: "CERT_" + Date.now(),
    userId: userId,
    namaEvent: String(event.nama || eventName),
    eventId: eventId,
    tanggal: String(p.tanggal || new Date().toISOString().slice(0, 10)),
    url: url
  };
  sheet.appendRow(headers.map(h => record[h] !== undefined ? record[h] : ""));
  return { success: true, message: "Sertifikat berhasil diunggah dan diberikan kepada peserta.", certificate: record, fileId: file.getId() };
  } finally {
    lock.releaseLock();
  }
}

function adminGetAllApplications(p) {
  const applications = sheetToObjects(getSheet(SHEET.APPLICATIONS)).filter(a => a.id);
  const users = sheetToObjects(getSheet(SHEET.USERS));
  return applications.map(app => {
    const user = users.find(u =>
      String(u.id || "") === String(app.userId || "") ||
      String(u.email || "").toLowerCase() === String(app.userId || "").toLowerCase()
    );
    return {
      ...app,
      namaPeserta: user ? (user.nama || "") : "",
      emailPeserta: user ? (user.email || "") : "",
      noHpPeserta: user ? (user.noHp || "") : "",
      jenisPeserta: user ? (user.jenis || "") : "",
      nimPeserta: user ? (user.nim || user.NIM || user.nimNis || "") : "",
      universitasPeserta: user ? (user.asalUniversitas || user.universitas || user.institusi || user.asalSekolah || "") : "",
      fakultasPeserta: user ? (user.fakultas || "") : "",
      prodiPeserta: user ? (user.programStudi || user.prodi || user.jurusan || "") : "",
      angkatanPeserta: user ? (user.angkatan || user.tahunMasuk || "") : "",
      alamatPeserta: user ? (user.alamat || "") : ""
    };
  });
}

function adminGetUsers(p) {
  // Tambahkan validasi admin jika perlu
  const sheet = getSheet(SHEET.USERS);
  return sheetToObjects(sheet).map(u => ({ ...u, passwordHash: undefined }));
}

function adminUpdateStatus(p) {
  const appId = String(p.appId || "").trim();
  const status = String(p.status || "").trim().toLowerCase();
  const catatan = String(p.catatan || "").trim().slice(0, 2000);
  const allowedStatuses = ["pending", "menunggu", "approved", "rejected"];
  if (!appId || !status) return { success: false, message: "Data tidak lengkap." };
  if (allowedStatuses.indexOf(status) < 0) return { success: false, message: "Status pendaftaran tidak valid." };

  const sheet = getSheet(SHEET.APPLICATIONS);
  const data = sheet.getDataRange().getValues();
  if (!data.length) return { success: false, message: "Pendaftaran tidak ditemukan." };
  const headers = data[0].map(h => String(h).trim());
  const idIdx = headers.indexOf("id"), statusIdx = headers.indexOf("status"), catatanIdx = headers.indexOf("catatan");
  if (idIdx < 0 || statusIdx < 0) return { success: false, message: "Kolom pendaftaran tidak lengkap." };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Sistem sedang memproses perubahan lain. Coba kembali." };
  try {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) !== appId) continue;
      const current = String(data[i][statusIdx] || "").trim().toLowerCase();
      if (current === "hadir") return { success: false, message: "Status tidak dapat diubah karena presensi sudah tercatat." };
      sheet.getRange(i + 1, statusIdx + 1).setValue(status);
      if (catatanIdx >= 0) sheet.getRange(i + 1, catatanIdx + 1).setValue(catatan);
      SpreadsheetApp.flush();
      eventNevAuditLog_(p.adminEmail, "application_status", appId, "Status: " + current + " -> " + status);
      return { success: true, message: "Status pendaftaran diperbarui." };
    }
    return { success: false, message: "Pendaftaran tidak ditemukan." };
  } finally {
    lock.releaseLock();
  }
}

function adminDeleteApp(p) {
  const appId = String(p.appId || "").trim();
  if (!appId) return { success: false, message: "ID tidak ada." };

  const sheet = getSheet(SHEET.APPLICATIONS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: false, message: "Data tidak ditemukan." };
  const headers = data[0].map(h => String(h).trim());
  const idIdx = headers.indexOf("id"), statusIdx = headers.indexOf("status"), eventIdx = headers.indexOf("eventId"), userIdx = headers.indexOf("userId");
  if (idIdx < 0 || statusIdx < 0 || eventIdx < 0 || userIdx < 0) return { success: false, message: "Kolom pendaftaran tidak lengkap." };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Sistem sedang memproses perubahan lain. Coba kembali." };
  try {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) !== appId) continue;
      const status = String(data[i][statusIdx] || "").trim().toLowerCase();
      const userId = String(data[i][userIdx] || "");
      const eventId = String(data[i][eventIdx] || "");
      const users = sheetToObjects(getSheet(SHEET.USERS));
      const targetUser = users.find(u => String(u.id || "").trim() === userId || String(u.email || "").trim().toLowerCase() === userId.trim().toLowerCase());
      const events = sheetToObjects(getSheet(SHEET.EVENTS));
      const targetEvent = events.find(ev => String(ev.id || "").trim() === eventId || String(ev.nama || "").trim().toLowerCase() === eventId.trim().toLowerCase());
      const userKeys = [userId.trim().toLowerCase(), String(targetUser && targetUser.email || "").trim().toLowerCase()].filter(Boolean);
      const eventKeys = [eventId.trim().toLowerCase(), String(targetEvent && targetEvent.nama || "").trim().toLowerCase()].filter(Boolean);
      const hasCertificate = sheetToObjects(getSheet(SHEET.CERTIFICATES)).some(cert =>
        userKeys.indexOf(String(cert.userId || "").trim().toLowerCase()) >= 0 &&
        eventKeys.indexOf(String(cert.eventId || "").trim().toLowerCase()) >= 0
      );
      if (status === "hadir" || hasCertificate) {
        return { success: false, message: "Pendaftaran ini memiliki riwayat kehadiran atau sertifikat. Data tidak dihapus agar riwayat tetap terjaga." };
      }
      sheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      eventNevAuditLog_(p.adminEmail, "application_deleted", appId, "eventId=" + eventId + "; userId=" + userId);
      return { success: true, message: "Pendaftaran berhasil dihapus." };
    }
    return { success: false, message: "Data tidak ditemukan." };
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
   AUDIT LOG — aktivitas admin yang berdampak pada data
   ========================================================= */
function eventNevAuditLog_(actor, action, target, details) {
  try {
    const ss = getDatabaseSpreadsheet_();
    let sheet = ss.getSheetByName("AuditLog");
    if (!sheet) sheet = ss.insertSheet("AuditLog");
    if (sheet.getLastRow() === 0) sheet.appendRow(["timestamp", "actor", "action", "target", "details"]);
    sheet.appendRow([
      new Date(),
      String(actor || "system").slice(0, 200),
      String(action || "").slice(0, 80),
      String(target || "").slice(0, 200),
      String(details || "").slice(0, 1000)
    ]);
    const last = sheet.getLastRow();
    if (last > 1001) sheet.deleteRows(2, last - 1001);
  } catch (err) {
    Logger.log("Audit log gagal ditulis: " + err.message);
  }
}

function adminGetAuditLog_() {
  const ss = getDatabaseSpreadsheet_();
  const sheet = ss.getSheetByName("AuditLog");
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheetToObjects(sheet).sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  }).slice(0, 100);
}

function adminGetStats() {
  const userCount = getSheet(SHEET.USERS).getLastRow() - 1;
  const eventCount = getSheet(SHEET.EVENTS).getLastRow() - 1;
  const appCount = getSheet(SHEET.APPLICATIONS).getLastRow() - 1;
  const apps = sheetToObjects(getSheet(SHEET.APPLICATIONS));
  const approved = apps.filter(a => /^(approved|disetujui|hadir)$/i.test(String(a.status || "").trim())).length;
  const pending = apps.filter(a => /^(pending|menunggu|)$/i.test(String(a.status || "").trim())).length;
  const attended = apps.filter(a => /^hadir$/i.test(String(a.status || "").trim())).length;
  const rejected = apps.filter(a => /^(rejected|ditolak)$/i.test(String(a.status || "").trim())).length;

  return {
    users: Math.max(userCount, 0),
    events: Math.max(eventCount, 0),
    applications: Math.max(appCount, 0),
    approved,
    pending,
    attended,
    rejected
  };
}


/* =========================================================
   ADMIN EDITOR — EVENT & TRAINER
   ========================================================= */
function adminDeleteTrainer_(p) {
  const trainerId = String(p.trainerId || "").trim();
  const email = String(p.adminEmail || "").trim().toLowerCase();
  if (!trainerId || !email) return { success: false, message: "Data penghapusan tidak lengkap." };
  const users = sheetToObjects(getSheet(SHEET.USERS));
  const admin = users.find(u => String(u.email || "").trim().toLowerCase() === email && String(u.jenis || "").trim() === "Admin");
  if (!admin) return { success: false, message: "Akses ditolak. Hanya admin yang dapat menghapus trainer." };
  const sheet = getSheet(SHEET.TRAINERS);
  const data = sheet.getDataRange().getValues();
  if (!data.length) return { success: false, message: "Data trainer tidak ditemukan." };
  const headers = data[0].map(h => String(h).trim());
  const idIndex = headers.indexOf("id");
  if (idIndex < 0) return { success: false, message: "Kolom id tidak ditemukan pada sheet Trainers." };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === trainerId) { sheet.deleteRow(i + 1); eventNevAuditLog_(email, "trainer_deleted", trainerId, "Trainer dihapus."); return { success: true, message: "Trainer berhasil dihapus." }; }
  }
  return { success: false, message: "Trainer tidak ditemukan." };
}
function adminDeleteEvent_(p) {
  const eventId = String(p.eventId || '').trim();
  const email = String(p.adminEmail || '').trim().toLowerCase();
  if (!eventId || !email) return { success: false, message: 'Data penghapusan tidak lengkap.' };
  const users = sheetToObjects(getSheet(SHEET.USERS));
  const admin = users.find(u => String(u.email || '').trim().toLowerCase() === email && String(u.jenis || '').trim() === 'Admin');
  if (!admin) return { success: false, message: 'Akses ditolak. Hanya admin yang dapat menghapus event.' };
  const sheet = getSheet(SHEET.EVENTS);
  const data = sheet.getDataRange().getValues();
  if (!data.length) return { success: false, message: 'Data event tidak ditemukan.' };
  const headers = data[0].map(h => String(h).trim());
  const idIndex = headers.indexOf('id');
  if (idIndex < 0) return { success: false, message: 'Kolom id tidak ditemukan pada sheet Events.' };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) !== eventId) continue;
    const eventName = String(data[i][headers.indexOf("nama")] || "").trim().toLowerCase();
    const eventKeys = [eventId.toLowerCase(), eventName].filter(Boolean);
    const applications = sheetToObjects(getSheet(SHEET.APPLICATIONS));
    const certificates = sheetToObjects(getSheet(SHEET.CERTIFICATES));
    const hasApplications = applications.some(a => eventKeys.indexOf(String(a.eventId || "").trim().toLowerCase()) >= 0);
    const hasCertificates = certificates.some(cert => eventKeys.indexOf(String(cert.eventId || "").trim().toLowerCase()) >= 0);
    if (hasApplications || hasCertificates) {
      return { success: false, message: "Event memiliki riwayat pendaftaran atau sertifikat. Nonaktifkan event melalui status agar riwayat tetap terjaga." };
    }
    sheet.deleteRow(i + 1);
    eventNevAuditLog_(email, "event_deleted", eventId, "Event dihapus setelah pemeriksaan riwayat.");
    return { success: true, message: 'Event berhasil dihapus.' };
  }
  return { success: false, message: 'Event tidak ditemukan.' };
}


/* Add missing optional columns without rewriting or deleting existing rows/data. */
function eventNevEnsureHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(h) { return String(h || "").trim(); });
  const missing = requiredHeaders.filter(function(name) { return headers.indexOf(name) < 0; });
  if (!missing.length) return;
  sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
  SpreadsheetApp.flush();
}

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
    : ["nama","jabatan","keahlian","foto","bio","instagram","linkedin","urutan"];

  if (!String(p.nama || "").trim()) return { success: false, message: "Nama wajib diisi." };
  if (isEvent && (!String(p.kategori || "").trim() || !String(p.tanggal || "").trim())) {
    return { success: false, message: "Kategori dan tanggal event wajib diisi." };
  }
  if (!isEvent && (!String(p.jabatan || "").trim() || !String(p.keahlian || "").trim())) {
    return { success: false, message: "Jabatan dan keahlian trainer wajib diisi." };
  }
  if (isEvent) {
    const quotaRaw = String(p.kuota == null ? "" : p.kuota).trim();
    if (quotaRaw && (!/^\d+$/.test(quotaRaw) || Number(quotaRaw) < 0)) {
      return { success: false, message: "Kuota harus berupa bilangan bulat nol atau lebih." };
    }
    const eventDate = String(p.tanggal || "").trim();
    const deadline = String(p.batasPendaftaran || "").trim();
    if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return { success: false, message: "Format tanggal event tidak valid." };
    }
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      return { success: false, message: "Format batas pendaftaran tidak valid." };
    }
    if (eventDate && deadline && deadline > eventDate) {
      return { success: false, message: "Batas pendaftaran tidak boleh setelah tanggal pelaksanaan event." };
    }
  }

  const sheet = getSheet(sheetName);
  const requiredHeaders = isEvent
    ? ["batasPendaftaran","sasaran","waktu","persyaratanFoto","deskripsi","gambar","syarat","kuota","biaya","status"]
    : ["bio","instagram","linkedin","urutan","foto","jabatan","keahlian"];
  eventNevEnsureHeaders_(sheet, requiredHeaders);
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

  const wasNew = rowNumber < 0;
  if (wasNew) {
    const newRow = headers.map(h => h === "createdAt" ? new Date().toISOString() : (record[h] !== undefined ? record[h] : ""));
    sheet.appendRow(newRow);
  } else {
    headers.forEach((h, index) => {
      if (record[h] !== undefined) sheet.getRange(rowNumber, index + 1).setValue(record[h]);
    });
  }
  eventNevAuditLog_(email, type + (wasNew ? "_created" : "_updated"), record.id, String(record.nama || ""));
  return { success: true, id: record.id, message: "Data berhasil disimpan." };
}
