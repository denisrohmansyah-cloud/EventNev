/**
 * EventNev API — Google Apps Script + Google Sheets
 * Deploy as Web App. Set Script Property ADMIN_EMAIL before deployment.
 * JSONP is used for GitHub Pages cross-origin compatibility. For high-risk production
 * deployments, migrate session transport to a backend with CORS/HTTP-only cookies.
 */
const APP = { name: 'EventNev', version: '1.0.0' };
const DEFAULT_SHEET_ID = '1y3nD14mwo93bRUKFENKwQLUxAtEQVLfYmyUBGQ5lAdE';
const TABLES = {
  Users: ['id','name','email','passwordHash','salt','role','status','createdAt'],
  Events: ['id','title','category','description','date','time','location','capacity','trainerId','status','registrationDeadline','requirements','createdAt','updatedAt'],
  Registrations: ['id','eventId','userId','name','email','phone','institution','reason','status','adminNote','createdAt','updatedAt'],
  Trainers: ['id','name','roleTitle','expertise','experience','certifications','bio','photoUrl','sortOrder','visible','createdAt','updatedAt'],
  Announcements: ['id','title','body','status','createdAt'],
  SiteSettings: ['key','value','updatedAt']
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  let result;
  try {
    if (p.action === 'health') result = { ok:true, app:APP.name, version:APP.version, time:new Date().toISOString() };
    else {
      const data = p.payload ? JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p.payload)).getDataAsString()) : {};
      result = route_(String(p.action || ''), data, p.token || '');
    }
  } catch (err) {
    result = { ok:false, error: safeError_(err) };
  }
  const json = JSON.stringify(result);
  const callback = String(p.callback || '');
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json.replace(/</g,'\\u003c') + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // Optional JSON API entry point for non-browser clients.
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    return ContentService.createTextOutput(JSON.stringify(route_(body.action || '', body.data || {}, body.token || '')))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:safeError_(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}

function setupDatabase() {
  const ss = getDb_();
  Object.keys(TABLES).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = TABLES[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#d71920').setFontColor('#ffffff');
    }
  });
  return 'Database EventNev siap. Pastikan Script Property ADMIN_EMAIL telah diatur.';
}

function getDb_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Database belum dikonfigurasi. Isi Script Property SHEET_ID dengan ID Google Sheets.');
}

function route_(action, data, token) {
  if (action === 'register') return register_(data);
  if (action === 'login') return login_(data);
  if (action === 'logout') { CacheService.getScriptCache().remove('session:'+token); return {ok:true}; }
  if (action === 'publicData') return publicData_();
  if (action === 'myDashboard') return myDashboard_(requireUser_(token));
  if (action === 'apply') return apply_(requireUser_(token), data);
  if (action === 'adminSummary') { requireAdmin_(token); return adminSummary_(); }
  if (action === 'adminRegistrations') { requireAdmin_(token); return {ok:true, registrations: rows_('Registrations')}; }
  if (action === 'adminUsers') { requireAdmin_(token); return {ok:true, users: rows_('Users').map(publicUser_)}; }
  if (action === 'adminUpdateRegistration') { requireAdmin_(token); return updateRegistration_(data); }
  if (action === 'adminSaveEvent') { requireAdmin_(token); return saveRow_('Events', data, ['title','category','description','date','time','location','capacity','trainerId','status','registrationDeadline','requirements']); }
  if (action === 'adminDeleteEvent') { requireAdmin_(token); return deleteRow_('Events', data.id); }
  if (action === 'adminSaveTrainer') { requireAdmin_(token); return saveRow_('Trainers', data, ['name','roleTitle','expertise','experience','certifications','bio','photoUrl','sortOrder','visible']); }
  if (action === 'uploadTrainerPhotoChunk') { requireAdmin_(token); return uploadTrainerPhotoChunk_(data, token); }
  if (action === 'finalizeTrainerPhoto') { requireAdmin_(token); return finalizeTrainerPhoto_(data, token); }
  if (action === 'adminDeleteTrainer') { requireAdmin_(token); return deleteRow_('Trainers', data.id); }
  if (action === 'adminUpdateUser') { requireAdmin_(token); return updateUser_(data); }
  if (action === 'adminAnnouncement') { requireAdmin_(token); return saveRow_('Announcements', data, ['title','body','status']); }
  if (action === 'adminSaveFooter') { requireAdmin_(token); return saveFooter_(data); }
  throw new Error('Aksi tidak dikenal.');
}


function uploadTrainerPhotoChunk_(d, token) {
  const id=String(d.uploadId||'').replace(/[^a-zA-Z0-9_-]/g,'');
  const index=Number(d.index),total=Number(d.total),chunk=String(d.chunk||'');
  if(!id||!Number.isInteger(index)||!Number.isInteger(total)||total<1||total>60||index<0||index>=total) throw new Error('Upload foto tidak valid.');
  if(!chunk||chunk.length>24000||!/^[A-Za-z0-9+/=]+$/.test(chunk)) throw new Error('Data foto tidak valid.');
  const cache=CacheService.getScriptCache(),prefix='trainerUpload:'+token+':'+id+':';
  cache.put(prefix+'meta',JSON.stringify({total:total}),600);
  cache.put(prefix+index,chunk,600);
  return {ok:true,index:index};
}
function finalizeTrainerPhoto_(d, token) {
  const id=String(d.uploadId||'').replace(/[^a-zA-Z0-9_-]/g,''),total=Number(d.total);
  if(!id||!Number.isInteger(total)||total<1||total>60) throw new Error('Upload foto tidak valid.');
  const cache=CacheService.getScriptCache(),prefix='trainerUpload:'+token+':'+id+':',meta=cache.get(prefix+'meta');
  if(!meta||Number(JSON.parse(meta).total)!==total) throw new Error('Sesi upload berakhir. Silakan unggah foto kembali.');
  const chunks=[];
  for(let i=0;i<total;i++){const part=cache.get(prefix+i);if(!part)throw new Error('Data foto belum lengkap. Silakan coba lagi.');chunks.push(part);}
  const base64=chunks.join('');
  if(base64.length>1300000)throw new Error('Foto terkompresi terlalu besar.');
  const mime=String(d.mimeType||'image/jpeg');
  if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Format foto tidak didukung.');
  const blob=Utilities.newBlob(Utilities.base64Decode(base64),mime,clean_(d.name||'trainer.jpg',120));
  const props=PropertiesService.getScriptProperties(),folderId=props.getProperty('TRAINER_PHOTO_FOLDER_ID');
  let folder=folderId?DriveApp.getFolderById(folderId):DriveApp.createFolder('EventNev Trainer Photos');
  if(!folderId)props.setProperty('TRAINER_PHOTO_FOLDER_ID',folder.getId());
  const file=folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  for(let i=0;i<total;i++)cache.remove(prefix+i);cache.remove(prefix+'meta');
  return {ok:true,photoUrl:'https://drive.google.com/uc?export=view&id='+file.getId()};
}

function register_(d) {
  const name = clean_(d.name,120), email = email_(d.email), password = String(d.password || '');
  if (name.length < 2) throw new Error('Nama minimal 2 karakter.');
  if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
  if (rows_('Users').some(u => String(u.email).toLowerCase() === email)) throw new Error('Email sudah terdaftar.');
  const salt = Utilities.getUuid();
  const adminEmail = String(PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || '').toLowerCase().trim();
  const role = email === adminEmail && adminEmail ? 'admin' : 'participant';
  const user = {id:uid_(),name,email,passwordHash:hash_(password,salt),salt,role,status:'active',createdAt:now_()};
  append_('Users', user);
  return {ok:true,message:role==='admin'?'Akun admin dibuat. Silakan login.':'Akun berhasil dibuat. Silakan login untuk mendaftar kegiatan.',user:publicUser_(user)};
}

function login_(d) {
  const email = email_(d.email), password = String(d.password || '');
  const user = rows_('Users').find(u => String(u.email).toLowerCase() === email);
  if (!user || hash_(password,String(user.salt)) !== String(user.passwordHash)) throw new Error('Email atau kata sandi tidak sesuai.');
  if (user.status !== 'active') throw new Error('Akun tidak aktif. Hubungi admin.');
  const token = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('session:'+token, JSON.stringify({id:user.id,email:user.email,role:user.role,name:user.name}), 21600);
  return {ok:true,token,user:publicUser_(user),expiresIn:21600};
}

function publicData_() {
  const allRegistrations = rows_('Registrations');
  const events = rows_('Events').filter(x => x.status === 'published').map(x => {
    x.registeredCount = allRegistrations.filter(r => r.eventId===x.id && ['pending','approved'].includes(r.status)).length;
    return x;
  });
  const participantIds = new Set(allRegistrations.filter(r => ['pending','approved','attended'].includes(String(r.status))).map(r => String(r.userId)).filter(Boolean));
  const alumniIds = new Set(allRegistrations.filter(r => String(r.status)==='attended').map(r => String(r.userId)).filter(Boolean));
  const stats = {events:events.length, participants:participantIds.size + 90, alumni:alumniIds.size + 60};
  return {ok:true,events,trainers:rows_('Trainers').filter(t => t.visible===true || String(t.visible)==='true'),announcements:rows_('Announcements').filter(a=>a.status==='published'),stats,footer:getFooter_()};
}

function getFooter_() {
  const defaults = {
    brandName:'Network Evolution', brandTagline:'Ora Konek Ora Kepenak', socialLinks:'Instagram|@nevtelkom_tup|https://www.instagram.com/nevtelkom_tup\nGitHub|NEVPurwokerto-Repo|https://github.com/NEVPurwokerto-Repo\nLinkedIn|Network Evolution Laboratory|https://www.linkedin.com/company/network-evolution-laboratory/home/\nYouTube|Network Evolution TUP|https://www.youtube.com/@networkevolutionittp9849',
    description:'Komunitas untuk belajar, berbagi, dan berkembang di bidang teknologi.',
    partnerLogos:'', trainingTitle:'Rumah Belajar Network Evolution',
    trainingAddress:'Alamat lokasi training dapat diatur oleh admin.',
    officeTitle:'Office & Exam Center Network Evolution',
    officeAddress:'Alamat kantor dapat diatur oleh admin.',
    email:'', phone:'', whatsapp:'',
    popularPages:'Daftar Training|#programs\nJadwal Training|#programs\nHubungi Kami|#about\nNetwork Evolution|#about',
    slogan:'ORA KONEK ORA KEPENAK', copyrightText:'Network Evolution. Built to connect.'
  };
  const values = {};
  rows_('SiteSettings').forEach(r => { if (String(r.key).indexOf('footer.')===0) values[String(r.key).slice(7)] = String(r.value || ''); });
  return Object.assign(defaults, values);
}
function saveFooter_(data) {
  const allowed = ['brandName','brandTagline','description','partnerLogos','trainingTitle','trainingAddress','officeTitle','officeAddress','email','phone','whatsapp','popularPages','slogan','copyrightText','socialLinks'];
  allowed.forEach(key => {
    const value = String(data[key] || '').slice(0, ['description','trainingAddress','officeAddress','partnerLogos','popularPages'].includes(key) ? 4000 : 500);
    const existing = rows_('SiteSettings').find(r => String(r.key) === 'footer.'+key);
    if (existing) { existing.value=value; existing.updatedAt=now_(); replaceRow_('SiteSettings', existing); }
    else append_('SiteSettings', {key:'footer.'+key, value, updatedAt:now_()});
  });
  return {ok:true, footer:getFooter_()};
}

function myDashboard_(user) {
  const regs = rows_('Registrations').filter(r=>r.userId===user.id);
  const events = rows_('Events');
  regs.forEach(r=>{ const ev=events.find(x=>x.id===r.eventId); r.eventTitle=ev?ev.title:'Kegiatan dihapus'; r.eventDate=ev?ev.date:''; r.category=ev?ev.category:''; });
  return {ok:true,user:publicUser_(user),registrations:regs};
}

function apply_(user,d) {
  const event = rows_('Events').find(x=>x.id===String(d.eventId) && x.status==='published');
  if (!event) throw new Error('Kegiatan tidak ditemukan atau pendaftaran ditutup.');
  if (event.registrationDeadline && new Date(event.registrationDeadline+'T23:59:59') < new Date()) throw new Error('Batas pendaftaran telah berakhir.');
  const registrations = rows_('Registrations');
  if (registrations.some(r=>r.eventId===event.id && r.userId===user.id && !['rejected','cancelled'].includes(r.status))) throw new Error('Kamu sudah mendaftar kegiatan ini.');
  const count = registrations.filter(r=>r.eventId===event.id && ['pending','approved'].includes(r.status)).length;
  if (Number(event.capacity)>0 && count>=Number(event.capacity)) throw new Error('Kuota kegiatan telah penuh.');
  const row={id:uid_(),eventId:event.id,userId:user.id,name:clean_(d.name||user.name,120),email:user.email,phone:clean_(d.phone,40),institution:clean_(d.institution,160),reason:clean_(d.reason,1500),status:'pending',adminNote:'',createdAt:now_(),updatedAt:now_()};
  append_('Registrations',row);
  return {ok:true,message:'Pendaftaran terkirim dan menunggu verifikasi admin.',registration:row};
}

function adminSummary_() {
  const users=rows_('Users'), events=rows_('Events'), regs=rows_('Registrations'), trainers=rows_('Trainers');
  return {ok:true,summary:{users:users.filter(u=>u.role==='participant').length,events:events.length,pending:regs.filter(r=>r.status==='pending').length,approved:regs.filter(r=>r.status==='approved').length,trainers:trainers.length},events,trainers};
}

function updateRegistration_(d) {
  const allowed=['pending','approved','rejected','cancelled','attended'];
  if (!allowed.includes(String(d.status))) throw new Error('Status pendaftaran tidak valid.');
  const row=rows_('Registrations').find(r=>r.id===String(d.id));
  if (!row) throw new Error('Pendaftaran tidak ditemukan.');
  row.status=String(d.status); row.adminNote=clean_(d.adminNote,1000); row.updatedAt=now_();
  replaceRow_('Registrations',row);
  return {ok:true,registration:row};
}

function saveRow_(table,d,fields) {
  const obj={};
  fields.forEach(k=>obj[k]=d[k]===undefined?'':d[k]);
  if (table==='Events') {
    if (!clean_(obj.title,180)) throw new Error('Judul kegiatan wajib diisi.');
    if (!['Bootcamp','Seminar','Webinar','Open Recruitment','Open Laboratory'].includes(String(obj.category))) throw new Error('Kategori kegiatan tidak valid.');
    obj.capacity=Math.max(0,Number(obj.capacity)||0);
    if (!['draft','published','closed'].includes(String(obj.status))) obj.status='draft';
  }
  if (table==='Trainers') {
    if (!clean_(obj.name,120)) throw new Error('Nama trainer wajib diisi.');
    obj.sortOrder=Number(obj.sortOrder)||0; obj.visible=(obj.visible===true || String(obj.visible)==='true');
  }
  obj.updatedAt=now_();
  if (d.id) {
    const old=rows_(table).find(r=>r.id===String(d.id));
    if (!old) throw new Error('Data tidak ditemukan.');
    Object.assign(old,obj); replaceRow_(table,old); return {ok:true,item:old};
  }
  obj.id=uid_(); obj.createdAt=now_(); append_(table,obj); return {ok:true,item:obj};
}

function deleteRow_(table,id) {
  if (!id) throw new Error('ID wajib diisi.');
  const sh=getDb_().getSheetByName(table), values=sh.getDataRange().getValues(), headers=values[0], idx=headers.indexOf('id');
  for(let i=1;i<values.length;i++) if(String(values[i][idx])===String(id)) { sh.deleteRow(i+1); return {ok:true}; }
  throw new Error('Data tidak ditemukan.');
}

function updateUser_(d) {
  const user=rows_('Users').find(u=>u.id===String(d.id));
  if(!user) throw new Error('Pengguna tidak ditemukan.');
  if(d.status && ['active','disabled'].includes(d.status)) user.status=d.status;
  if(d.role && ['participant','admin'].includes(d.role)) {
    const current=rows_('Users').filter(u=>u.role==='admin' && u.status==='active');
    if(user.role==='admin' && d.role!=='admin' && current.length<=1) throw new Error('Tidak dapat menurunkan admin aktif terakhir.');
    user.role=d.role;
  }
  replaceRow_('Users',user); return {ok:true,user:publicUser_(user)};
}

function requireUser_(token) {
  const raw=CacheService.getScriptCache().get('session:'+String(token||''));
  if(!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  const session=JSON.parse(raw), user=rows_('Users').find(u=>u.id===session.id);
  if(!user || user.status!=='active') throw new Error('Akun tidak aktif.');
  return user;
}
function requireAdmin_(token) { const u=requireUser_(token); if(u.role!=='admin') throw new Error('Akses ditolak. Khusus admin.'); return u; }
function rows_(table) {
  const sh=getDb_().getSheetByName(table); if(!sh) throw new Error('Sheet '+table+' belum tersedia. Jalankan setupDatabase().');
  const v=sh.getDataRange().getValues(); if(v.length<2) return [];
  const h=v[0].map(String);
  return v.slice(1).filter(r=>r.some(c=>c!=='' && c!==null)).map(r=>{const o={};h.forEach((k,i)=>o[k]=normal_(r[i]));return o;});
}
function append_(table,obj) { const sh=getDb_().getSheetByName(table), h=TABLES[table]; sh.appendRow(h.map(k=>obj[k]===undefined?'':obj[k])); }
function replaceRow_(table,obj) {
  const sh=getDb_().getSheetByName(table), v=sh.getDataRange().getValues(), h=v[0].map(String), ix=h.indexOf('id');
  for(let i=1;i<v.length;i++) if(String(v[i][ix])===String(obj.id)){sh.getRange(i+1,1,h.length).setValues([h.map(k=>obj[k]===undefined?'':obj[k])]);return;}
  throw new Error('Data tidak ditemukan saat menyimpan.');
}
function publicUser_(u) { return {id:u.id,name:u.name,email:u.email,role:u.role,status:u.status,createdAt:u.createdAt}; }
function hash_(password,salt) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+'::'+password,Utilities.Charset.UTF_8)); }
function email_(v) { const e=String(v||'').trim().toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Format email tidak valid.'); return e; }
function clean_(v,max) { return String(v==null?'':v).replace(/[<>]/g,'').trim().slice(0,max); }
function uid_() { return Utilities.getUuid(); }
function now_() { return new Date().toISOString(); }
function normal_(v) { if(v instanceof Date) return v.toISOString(); return v; }
function safeError_(err) { return String(err && err.message ? err.message : err).slice(0,300); }
