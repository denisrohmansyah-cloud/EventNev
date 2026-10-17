# EventNev — Network Evolution

Website pendaftaran Bootcamp, Seminar, Webinar, Open Recruitment, dan Open Laboratory dengan dashboard peserta/admin, profil trainer, serta verifikasi pendaftaran.

## Arsitektur

- Frontend statis: GitHub Pages
- Backend: Google Apps Script Web App
- Database: Google Sheets
- Warna: merah, putih, hitam
- Slogan: **Ora Konek Ora Kepenak**

## File

- `index.html`, `styles.css`, `app.js`: frontend responsif.
- `Code.gs`: API dan pembuatan struktur database.
- `README.md`: petunjuk deployment.

## Setup Google Sheets dan Apps Script

1. Buat Google Spreadsheet baru dengan nama `EventNev Database`.
2. Buka **Extensions → Apps Script** dari spreadsheet tersebut.
3. Ganti kode editor dengan isi file `Code.gs` dari repository.
4. Buka **Project Settings → Script Properties**, lalu tambahkan:
   - `SHEET_ID`: ID spreadsheet dari URL Google Sheets.
   - `ADMIN_EMAIL`: email yang akan menjadi admin pertama. Gunakan email yang dikendalikan pengelola.
5. Jalankan fungsi `setupDatabase` dari editor Apps Script dan berikan izin yang diperlukan. Ini membuat sheet Users, Events, Registrations, Trainers, dan Announcements.
6. Dari **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (dibutuhkan untuk website publik; endpoint tetap melakukan pemeriksaan role untuk aksi privat).
7. Deploy, salin URL Web App yang berakhiran `/exec`.
8. Buka `app.js` dan isi `const API_URL = 'https://script.google.com/macros/s/AKfycbybwMPI1cbVV8pGJvjnC3Uq_kg6llnzoCX5XoyJhbXc8nFu8YjNoItf65Ywojtr6KW1/exec';` dengan URL deployment, misalnya `const API_URL = 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec';`.
9. Commit perubahan dan aktifkan GitHub Pages di **Settings → Pages**, pilih branch `main` dan folder `/ (root)`.
10. Buka website. Daftarkan akun menggunakan email yang sama persis dengan `ADMIN_EMAIL` untuk membuat admin pertama. Pastikan admin pertama berhasil login, kemudian batasi atau ubah proses pemberian role admin sesuai kebijakan pengelola.

## Mengelola kegiatan

Login sebagai admin → **Kelola Kegiatan** → isi judul, kategori, tanggal, kapasitas, batas pendaftaran, deskripsi, dan status. Pilih **Publikasikan** agar kegiatan terlihat oleh pengunjung. Status draft tidak muncul di katalog publik.

## Verifikasi pendaftaran

Peserta membuat akun lalu mendaftar kegiatan. Pendaftaran baru berstatus **pending**. Admin membuka **Pendaftaran Peserta** untuk menyetujui atau menolak pengajuan. Status akan terlihat di dashboard peserta.

## Profil trainer

Admin membuka **Profil Trainer** untuk menambah atau mengedit nama, jabatan, keahlian, pengalaman, sertifikasi, bio, URL foto, dan visibilitas profil. Untuk URL foto, gunakan tautan HTTPS publik yang stabil.

## Catatan keamanan penting sebelum produksi

- Implementasi ini adalah fondasi awal, bukan audit keamanan atau sertifikasi production-ready.
- Transport browser menggunakan JSONP agar frontend GitHub Pages dapat memanggil Apps Script lintas domain. JSONP berjalan sebagai JavaScript dan tidak cocok untuk payload sensitif; hindari memasukkan rahasia atau data sensitif dalam URL. Migrasikan operasi sensitif ke API dengan CORS yang benar dan cookie HttpOnly/Secure/SameSite sebelum skala produksi.
- Password disimpan sebagai hash SHA-256 dengan salt. Untuk produksi, gunakan algoritme password hashing khusus seperti Argon2id/bcrypt di backend yang mendukungnya; SHA-256 saja bukan pilihan ideal untuk penyimpanan password.
- Sesi saat ini memakai CacheService selama maksimum 6 jam dan dapat berakhir lebih awal. Jangan gunakan untuk proses yang memerlukan sesi tahan lama.
- Google Apps Script dan Sheets memiliki kuota dan batas konkurensi; tambahkan LockService dan validasi tambahan sebelum menerima banyak pendaftar serentak.
- Atur pembatasan pembuatan akun admin. Pada fondasi ini, email ADMIN_EMAIL menjadi admin saat registrasi; setelah admin pertama dibuat, hapus atau kosongkan properti ADMIN_EMAIL dan ubah pemberian role admin hanya melalui proses yang dikendalikan pemilik.
- Jangan menyimpan token, kata sandi, kunci API, atau data rahasia di repository frontend.
- Uji akses peserta ke semua aksi admin, input tidak valid, duplikasi pendaftaran, kapasitas kegiatan, dan kondisi kuota sebelum digunakan untuk kegiatan resmi.
