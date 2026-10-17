/**
 * EventNev — scanner.js
 * QR code scanner for attendance
 */
"use strict";

(function () {
  const SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

  let stream = null;
  let animationFrame = null;
  let scanning = false;

  function getOverlay() { return document.getElementById("scannerOverlay"); }
  function getVideo() { return document.getElementById("scannerVideo"); }
  function getCanvas() { return document.getElementById("scannerCanvas"); }
  function getResult() { return document.getElementById("scannerResult"); }

  async function open() {
    const overlay = getOverlay();
    const video = getVideo();
    const result = getResult();
    if (!overlay || !video) return;

    if (result) result.textContent = "";
    overlay.hidden = false;
    scanning = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } }
      });
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(tick);
    } catch (err) {
      if (result) result.textContent = "Kamera tidak tersedia: " + err.message;
    }
  }

  function close() {
    scanning = false;
    if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const video = getVideo();
    if (video) { video.srcObject = null; }
    const overlay = getOverlay();
    if (overlay) overlay.hidden = true;
  }

  function tick() {
    if (!scanning) return;
    const video = getVideo();
    const canvas = getCanvas();
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrame = requestAnimationFrame(tick);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (window.jsQR) {
      const code = window.jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: "dontInvert"
      });
      if (code && code.data) {
        handleScan(code.data);
        return;
      }
    }

    animationFrame = requestAnimationFrame(tick);
  }

  async function handleScan(data) {
    scanning = false;
    const result = getResult();
    if (result) result.textContent = "Memproses…";

    try {
      let parsed;
      try { parsed = JSON.parse(data); } catch { parsed = { uid: data }; }

      const user = JSON.parse(localStorage.getItem("nevUser") || "{}");
      const url = new URL(SCRIPT_URL);
      url.searchParams.set("action", "absen");
      url.searchParams.set("scannerUid", user.id || user.email || "");
      url.searchParams.set("targetUid", parsed.uid || data);
      url.searchParams.set("ts", Date.now());

      const res = await fetch(url.toString());
      const resp = await res.json();

      if (result) {
        if (resp.success) {
          result.textContent = "✓ Absensi berhasil: " + (resp.nama || parsed.uid || "—");
          result.style.color = "#4ade80";
        } else {
          result.textContent = "✗ " + (resp.message || "Absensi gagal.");
          result.style.color = "#ff4b53";
        }
      }
    } catch {
      if (result) {
        result.textContent = "QR tidak valid atau gagal terhubung.";
        result.style.color = "#ff4b53";
      }
    }

    setTimeout(() => {
      if (!scanning) close();
    }, 3000);
  }

  window.NEVScanner = { open, close };

  // Auto-bind close button
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("closeScannerBtn")?.addEventListener("click", close);
    document.getElementById("scanAbsenBtn")?.addEventListener("click", open);
  });
})();
