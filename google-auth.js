/**
 * EventNev — google-auth.js
 * Google OAuth integration helper
 *
 * Untuk menggunakan Google Sign-In:
 * 1. Daftarkan project di Google Cloud Console
 * 2. Aktifkan Google+ API / Google Identity API
 * 3. Buat OAuth 2.0 Client ID (Web application)
 * 4. Ganti GOOGLE_CLIENT_ID di bawah
 * 5. Tambahkan script Google GSI ke login.html
 */

"use strict";

const GOOGLE_CLIENT_ID = "GANTI_DENGAN_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

/**
 * Initialize Google Sign-In button
 * Call this in login.html after loading the GSI library
 */
function initGoogleSignIn(buttonElementId, callback) {
  if (!window.google?.accounts?.id) {
    console.warn("Google Identity Services library not loaded.");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => handleGoogleCredential(response, callback),
    auto_select: false,
  });

  const btn = document.getElementById(buttonElementId);
  if (btn) {
    google.accounts.id.renderButton(btn, {
      type: "standard",
      shape: "rectangular",
      theme: "filled_black",
      text: "signin_with",
      size: "large",
      width: "100%",
    });
  }
}

/**
 * Parse Google JWT credential and extract user info
 */
function parseGoogleCredential(credential) {
  try {
    const base64Url = credential.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map(c =>
      "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(""));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Handle Google credential response
 */
async function handleGoogleCredential(response, callback) {
  const payload = parseGoogleCredential(response.credential);
  if (!payload) {
    console.error("Invalid Google credential");
    return;
  }

  const googleUser = {
    googleId: payload.sub,
    nama: payload.name,
    email: payload.email,
    foto: payload.picture,
  };

  if (typeof callback === "function") {
    callback(googleUser);
  }
}

/**
 * Sign out from Google
 */
function googleSignOut() {
  if (window.google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
}

window.NEVGoogleAuth = {
  init: initGoogleSignIn,
  signOut: googleSignOut,
};
