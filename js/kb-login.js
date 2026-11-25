// Log in with Kiwibase, for UmaCollector.
// 1. Adds a "Log in with Kiwibase" button to the site's log in / sign up window. It opens Kiwibase, which signs the
//    user in there and comes back here with a one-hour sign-in token in the URL fragment (#kbtoken=…).
// 2. On load, takes that token out of the address bar at once and signs in with it (signInWithCustomToken), using the
//    site's own Firebase app, so the rest of the site (window.UmaAuth) sees an ordinary signed-in user.
// Load it after the site's auth module: <script type="module" src="js/kb-login.js"></script>
// The SDK version must be the one the site's auth.js imports (13.1.0), or getApp() finds no app.

import { getApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

const PROJECT = "umacollector";
const KIWIBASE = "https://kiwibase.github.io/#/sso/" + PROJECT;
const FORM = ".modal form.auth-form";
const BUTTON_CLASS = "auth-go kb-login";

// ---- the token coming back from Kiwibase
const m = /^#kbtoken=([^&]+)/.exec(location.hash);
if (m) {
  const token = decodeURIComponent(m[1]);
  // Out of the address bar and history before the site's router reads it
  history.replaceState(null, "", location.pathname + location.search);
  signInWithCustomToken(getAuth(getApp()), token).catch((err) => console.warn("Kiwibase sign-in failed", err && err.code));
}

// ---- the button, under the form's own submit button
function addButton(form) {
  if (form.querySelector(".kb-login")) return;
  const a = document.createElement("a");
  a.className = BUTTON_CLASS;
  a.href = KIWIBASE;
  a.textContent = "Log in with Kiwibase";
  a.style.display = "block";
  a.style.textAlign = "center";
  a.style.textDecoration = "none";
  a.style.marginTop = "8px";
  form.appendChild(a);
}
new MutationObserver(() => document.querySelectorAll(FORM).forEach(addButton)).observe(document.body, { childList: true, subtree: true });
document.querySelectorAll(FORM).forEach(addButton);
