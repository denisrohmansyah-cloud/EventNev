/**
 * EventNev — scanner.js
 * Presensi hanya dapat dicatat oleh akun Admin yang memiliki session token valid.
 */
"use strict";
(function () {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgaSasJsN-J20DjJdKJ_0QHsA_8u_r9nqln6ZFFSrcPdljrMzZLkleEfqExnJvNMty/exec";
  let stream = null, animationFrame = null, scanning = false, submitting = false;
  const el = id => document.getElementById(id);
  const getOverlay = () => el("scannerOverlay");
  const getVideo = () => el("scannerVideo");
  const getCanvas = () => el("scannerCanvas");
  const getResult = () => el("scannerResult");
  const getToken = () => localStorage.getItem("nevSession") || "";
  const getUser = () => { try { return JSON.parse(localStorage.getItem("nevUser") || "null"); } catch (_) { return null; } };

  async function open() {
    const overlay = getOverlay(), video = getVideo(), result = getResult();
    if (!overlay || !video) return;
    const user = getUser();
    if (!getToken() || !user || String(user.jenis || user.role || "").toLowerCase() !== "admin") {
      if (result) result.textContent = "Fitur presensi pemindai hanya tersedia untuk Admin. Peserta cukup menampilkan QR peserta.";
      overlay.hidden = false;
      return;
    }
    const eventSelect = el("scannerEventSelect");
    if (!eventSelect) { if (result) result.textContent = "Pilihan kegiatan tidak tersedia. Perbarui halaman."; overlay.hidden = false; return; }
    overlay.hidden = false;
    if (result) result.textContent = "Memuat daftar kegiatan…";
    eventSelect.disabled = true;
    try {
      const response = await fetch(SCRIPT_URL + "?action=getEvents", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "Gagal memuat kegiatan.");
      const events = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
      eventSelect.replaceChildren(new Option("Pilih kegiatan untuk presensi", ""));
      events.forEach(event => {
        if (!event || !event.id || !event.nama) return;
        eventSelect.add(new Option(String(event.nama), String(event.id)));
      });
      eventSelect.disabled = false;
      if (result) result.textContent = events.length ? "Pilih kegiatan, lalu arahkan kamera ke QR peserta." : "Belum ada kegiatan yang tersedia.";
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } } });
      video.srcObject = stream;
      await video.play();
      scanning = true;
      animationFrame = requestAnimationFrame(tick);
    } catch (err) {
      if (result) result.textContent = "Scanner tidak dapat dimulai: " + (err.message || "periksa izin kamera dan koneksi.");
      stopCamera();
    }
  }
  function stopCamera() {
    scanning = false;
    if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const video = getVideo(); if (video) video.srcObject = null;
  }
  function close() { stopCamera(); submitting = false; const overlay = getOverlay(); if (overlay) overlay.hidden = true; }
  function tick() {
    if (!scanning || submitting) return;
    const video = getVideo(), canvas = getCanvas();
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) { animationFrame = requestAnimationFrame(tick); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (window.jsQR) {
      const code = window.jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) { handleScan(code.data); return; }
    }
    animationFrame = requestAnimationFrame(tick);
  }
  async function handleScan(data) {
    const result = getResult(), eventId = el("scannerEventSelect")?.value || "";
    if (!eventId) {
      if (result) result.textContent = "Pilih kegiatan terlebih dahulu.";
      animationFrame = requestAnimationFrame(tick); return;
    }
    submitting = true; scanning = false;
    if (result) result.textContent = "Memproses presensi…";
    try {
      let parsed; try { parsed = JSON.parse(data); } catch (_) { parsed = { uid: data }; }
      const targetUid = String(parsed.uid || parsed.id || parsed.email || "").trim();
      if (!targetUid) throw new Error("Format QR peserta tidak dikenali.");
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "absen", sessionToken: getToken(), targetUid, eventId })
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.message || "Presensi gagal.");
      if (result) { result.textContent = "✓ " + (payload.message || "Presensi berhasil") + ": " + (payload.nama || targetUid) + (payload.namaEvent ? " — " + payload.namaEvent : ""); result.style.color = "#4ade80"; }
    } catch (err) {
      if (result) { result.textContent = "✗ " + (err.message || "QR tidak valid atau gagal terhubung."); result.style.color = "#ff4b53"; }
    }
    submitting = false;
    window.setTimeout(() => { if (getOverlay() && !getOverlay().hidden) { const resultNow = getResult(); if (resultNow && resultNow.textContent.startsWith("✓")) { resultNow.textContent = "Siap untuk memindai peserta berikutnya."; resultNow.style.color = "#fff"; } scanning = true; animationFrame = requestAnimationFrame(tick); } }, 1800);
  }
  window.NEVScanner = { open, close };
  document.addEventListener("DOMContentLoaded", () => {
    el("closeScannerBtn")?.addEventListener("click", close);
    el("scanAbsenBtn")?.addEventListener("click", open);
  });
})();