/* Paper Fight Bot — the whole signed-in side of the site.
   ---------------------------------------------------------------------------
   Loaded as a module on every page. It works out which page it is on and
   wires up only what that page needs.

   Accounts are email and password. Discord sign in would have needed
   Identity Platform, which is a paid tier, so it is not here.

   Being the owner is a field on your own user document, set by hand once in
   the Firestore console. See FIREBASE-SETUP.md. The rules stop anyone
   promoting themselves.
   --------------------------------------------------------------------------- */

import { auth, db } from "./firebase.js";
import { renderMarkdown } from "./md.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const HEAD_PX = 24;
const head = (name, px) => "https://mc-heads.net/avatar/" + encodeURIComponent(name) + "/" + px;
const headAlt = (name, px) => "https://minotar.net/helm/" + encodeURIComponent(name) + "/" + px + ".png";

const state = { user: null, profile: null, ready: false };

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const page = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();

function isOwner() {
  return !!(state.profile && state.profile.role === "owner");
}

function displayName() {
  if (state.profile && state.profile.mcName) return state.profile.mcName;
  if (state.user) return state.user.email;
  return null;
}

function paintHead(img, name, px) {
  if (!img || !name) return;
  img.alt = name + "'s Minecraft head";
  img.style.display = "";
  img.onerror = () => {
    img.onerror = () => { img.onerror = null; img.style.display = "none"; };
    img.src = headAlt(name, px);
  };
  img.src = head(name, px);
}

function when(el, text, bad) {
  if (!el) return;
  el.textContent = text || "";
  el.style.color = bad ? "var(--ember)" : "var(--grass)";
  el.hidden = !text;
}

/** Firebase error codes are not for humans. */
function friendly(err) {
  const code = (err && err.code) || "";
  if (code.includes("email-already-in-use")) return "That email already has an account. Sign in instead.";
  if (code.includes("invalid-email")) return "That does not look like an email address.";
  if (code.includes("weak-password")) return "Password needs to be at least six characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")
      || code.includes("user-not-found")) return "Email or password is wrong.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a minute and go again.";
  if (code.includes("network")) return "Could not reach the server. Check your connection.";
  if (code.includes("permission-denied")) return "You are not allowed to do that.";
  return (err && err.message) || "Something went wrong.";
}

const stamp = value => {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

// --------------------------------------------------------------- the nav

function mountNav() {
  const nav = $(".bar nav");
  if (!nav || nav.querySelector(".auth")) return;

  const reports = document.createElement("a");
  reports.href = "reports.html";
  reports.textContent = "Reports";
  reports.hidden = true;
  nav.appendChild(reports);

  const admin = document.createElement("a");
  admin.href = "admin.html";
  admin.textContent = "Edit";
  admin.hidden = true;
  nav.appendChild(admin);

  const pill = document.createElement("a");
  pill.className = "auth";
  pill.href = "account.html";
  // sized here as well as in the stylesheet, so a cached style.css cannot
  // blow the head up to full size and shove the nav off screen
  pill.style.cssText = "display:inline-flex;align-items:center;gap:8px;flex:none;" +
    "white-space:nowrap;text-decoration:none;line-height:1";
  nav.appendChild(pill);

  refresh.push(() => {
    reports.hidden = !state.user;
    admin.hidden = !isOwner();
    pill.textContent = "";
    const name = displayName();
    if (!name) { pill.textContent = "Sign in"; return; }

    const mc = state.profile && state.profile.mcName;
    if (mc) {
      const img = document.createElement("img");
      img.width = HEAD_PX; img.height = HEAD_PX;
      img.style.cssText = "width:" + HEAD_PX + "px;height:" + HEAD_PX +
        "px;image-rendering:pixelated;display:block;flex:none";
      paintHead(img, mc, 64);
      pill.appendChild(img);
    }
    const who = document.createElement("span");
    who.className = "who";
    who.style.cssText = "max-width:13ch;overflow:hidden;text-overflow:ellipsis";
    who.textContent = name;
    pill.appendChild(who);
  });
}

const refresh = [];
const rerender = () => refresh.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

// ----------------------------------------------------------- account page

function mountAccount() {
  const why = $("[data-why]");
  const next = new URLSearchParams(location.search).get("next");
  if (why && next) {
    why.textContent = "Sign in and you will be taken on to " + next + ".";
    why.hidden = false;
  }

  const email = $("#email"), pass = $("#password");
  const note = $("#authNote");

  const go = () => {
    if (next && /^[a-z0-9._-]+\.html$/i.test(next)) location.href = next;
  };

  const onSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email.value.trim(), pass.value);
      when(note, "");
      go();
    } catch (e) { when(note, friendly(e), true); }
  };

  const onRegister = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.value.trim(), pass.value);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email, mcName: "", role: "user", createdAt: serverTimestamp()
      });
      when(note, "");
      go();
    } catch (e) { when(note, friendly(e), true); }
  };

  const onReset = async () => {
    if (!email.value.trim()) return when(note, "Put your email in first.", true);
    try {
      await sendPasswordResetEmail(auth, email.value.trim());
      when(note, "Reset email sent. Check your inbox.");
    } catch (e) { when(note, friendly(e), true); }
  };

  $("#signIn") && $("#signIn").addEventListener("click", onSignIn);
  $("#register") && $("#register").addEventListener("click", onRegister);
  $("#reset") && $("#reset").addEventListener("click", onReset);
  pass && pass.addEventListener("keydown", e => { if (e.key === "Enter") onSignIn(); });
  $$("[data-signout]").forEach(b => b.addEventListener("click", () => signOut(auth)));

  const mcInput = $("#mcname"), mcNote = $("#mcNote");
  $("#saveMc") && $("#saveMc").addEventListener("click", async () => {
    const value = (mcInput.value || "").trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(value)) {
      return when(mcNote, "Three to sixteen letters, numbers or underscores.", true);
    }
    try {
      await updateDoc(doc(db, "users", state.user.uid), { mcName: value });
      state.profile.mcName = value;
      when(mcNote, "Saved.");
      rerender();
    } catch (e) { when(mcNote, friendly(e), true); }
  });

  refresh.push(() => {
    const out = $("[data-signed-out]"), inn = $("[data-signed-in]");
    if (out) out.hidden = !!state.user;
    if (inn) inn.hidden = !state.user;
    if (!state.user) return;

    const nameEl = $("[data-user-name]");
    if (nameEl) nameEl.textContent = displayName() || "there";
    const roleEl = $("[data-user-role]");
    if (roleEl) roleEl.textContent = isOwner() ? "Owner" : "Player";

    const card = $("[data-mc-card]");
    const mc = state.profile && state.profile.mcName;
    if (card) card.hidden = !mc;
    if (mc) {
      paintHead($("[data-mc-head]"), mc, 128);
      const n = $("[data-mc-name]");
      if (n) n.textContent = mc;
      if (mcInput && !mcInput.value) mcInput.value = mc;
    }
  });
}

// ------------------------------------------------------------ report form

const FIELDS = ["mcname", "pluginver", "server", "what", "steps", "console"];
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };

function mountReportForm() {
  const status = $("#status");

  refresh.push(() => {
    if (state.ready && !state.user) {
      location.replace("account.html?next=report.html");
      return;
    }
    const mc = state.profile && state.profile.mcName;
    const nameEl = document.getElementById("mcname");
    if (nameEl && !nameEl.value && mc) nameEl.value = mc;
    const ver = document.getElementById("pluginver");
    if (ver && !ver.value && typeof CONFIG !== "undefined") ver.value = CONFIG.version || "";
  });

  $("#sendReport") && $("#sendReport").addEventListener("click", async () => {
    const gaps = [];
    if (!val("mcname")) gaps.push("your Minecraft name");
    if (!val("pluginver")) gaps.push("the plugin version");
    if (!val("server")) gaps.push("your server software and version");
    if (val("what").length < 15) gaps.push("a bit more detail on what went wrong");
    if (gaps.length) return when(status, "Still need " + gaps.join(", ") + ".", true);

    try {
      const payload = { uid: state.user.uid, status: "open", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      FIELDS.forEach(f => payload[f] = val(f));
      const ref = await addDoc(collection(db, "reports"), payload);
      location.href = "reports.html?id=" + ref.id;
    } catch (e) {
      when(status, friendly(e), true);
    }
  });
}

// ---------------------------------------------------------- reports pages

async function loadReports() {
  const list = $("#reportList");
  if (!list) return;
  list.textContent = "Loading...";

  try {
    const q = isOwner()
      ? query(collection(db, "reports"), orderBy("createdAt", "desc"))
      : query(collection(db, "reports"), where("uid", "==", state.user.uid));

    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0));

    if (!rows.length) {
      list.innerHTML = '<p class="lede">No reports yet. '
        + '<a href="report.html" style="color:var(--iron)">File one</a>.</p>';
      return;
    }

    list.innerHTML = rows.map(r => `
      <a class="rep" href="reports.html?id=${r.id}">
        <span class="rep-status ${r.status || "open"}">${r.status || "open"}</span>
        <span class="rep-what">${(r.what || "").slice(0, 90)}</span>
        <span class="rep-meta">${r.mcname || "someone"} &middot; ${r.pluginver || "?"} &middot; ${stamp(r.createdAt)}</span>
      </a>`).join("");
  } catch (e) {
    list.innerHTML = `<p class="lede" style="color:var(--ember)">${friendly(e)}</p>`;
  }
}

async function loadThread(id) {
  const wrap = $("#thread");
  if (!wrap) return;
  wrap.textContent = "Loading...";

  try {
    const snap = await getDoc(doc(db, "reports", id));
    if (!snap.exists()) { wrap.innerHTML = '<p class="lede">That report does not exist.</p>'; return; }
    const r = snap.data();

    const msgs = [];
    const m = await getDocs(query(collection(db, "reports", id, "messages"), orderBy("createdAt", "asc")));
    m.forEach(d => msgs.push(d.data()));

    wrap.innerHTML = `
      <div class="rep-head">
        <span class="rep-status ${r.status || "open"}">${r.status || "open"}</span>
        <div class="rep-meta">${r.mcname || "someone"} &middot; ${r.pluginver || "?"} on ${r.server || "?"} &middot; ${stamp(r.createdAt)}</div>
      </div>
      <h2>What went wrong</h2>
      <p>${(r.what || "").replace(/\n/g, "<br>")}</p>
      ${r.steps ? `<h2>Steps to reproduce</h2><p>${r.steps.replace(/\n/g, "<br>")}</p>` : ""}
      ${r.console ? `<h2>Console output</h2><pre>${r.console.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>` : ""}
      <h2>Replies</h2>
      <div class="msgs">${msgs.length ? msgs.map(x => `
        <div class="msg ${x.isStaff ? "staff" : ""}">
          <div class="msg-who">${x.name || "someone"}${x.isStaff ? ' <span class="badge">staff</span>' : ""} <span class="msg-when">${stamp(x.createdAt)}</span></div>
          <div class="msg-body">${(x.body || "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])).replace(/\n/g, "<br>")}</div>
        </div>`).join("") : '<p class="lede">No replies yet.</p>'}</div>`;

    const box = $("#replyBox");
    if (box) box.hidden = false;
    const owner = isOwner();
    const tools = $("#ownerTools");
    if (tools) tools.hidden = !owner;
  } catch (e) {
    wrap.innerHTML = `<p class="lede" style="color:var(--ember)">${friendly(e)}</p>`;
  }
}

function mountReports() {
  const id = new URLSearchParams(location.search).get("id");

  $("#sendReply") && $("#sendReply").addEventListener("click", async () => {
    const body = ($("#replyText").value || "").trim();
    const note = $("#replyNote");
    if (body.length < 2) return when(note, "Write something first.", true);
    try {
      await addDoc(collection(db, "reports", id, "messages"), {
        uid: state.user.uid,
        name: displayName() || "someone",
        body,
        isStaff: isOwner(),
        createdAt: serverTimestamp()
      });
      if (isOwner()) {
        await updateDoc(doc(db, "reports", id), { status: "answered", updatedAt: serverTimestamp() });
      }
      $("#replyText").value = "";
      when(note, "");
      loadThread(id);
    } catch (e) { when(note, friendly(e), true); }
  });

  $$("[data-set-status]").forEach(btn => btn.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "reports", id), {
        status: btn.getAttribute("data-set-status"), updatedAt: serverTimestamp()
      });
      loadThread(id);
    } catch (e) { when($("#replyNote"), friendly(e), true); }
  }));

  refresh.push(() => {
    if (state.ready && !state.user) {
      location.replace("account.html?next=reports.html");
      return;
    }
    if (!state.user) return;
    const listWrap = $("#listWrap"), threadWrap = $("#threadWrap");
    if (id) {
      if (listWrap) listWrap.hidden = true;
      if (threadWrap) threadWrap.hidden = false;
      loadThread(id);
    } else {
      if (threadWrap) threadWrap.hidden = true;
      if (listWrap) listWrap.hidden = false;
      const heading = $("#listHeading");
      if (heading) heading.textContent = isOwner() ? "Every report" : "Your reports";
      loadReports();
    }
  });
}

// -------------------------------------------------- owner content editing

async function loadContent(key, target, hideSel) {
  try {
    const snap = await getDoc(doc(db, "content", key));
    if (!snap.exists()) return;
    const md = snap.data().markdown;
    if (!md || !md.trim()) return;
    const host = $(target);
    if (!host) return;
    host.innerHTML = renderMarkdown(md);
    // the built in sidebar links to built in headings, so it goes away once
    // the page is the owner's own text
    if (hideSel) { const el = $(hideSel); if (el) el.hidden = true; }
    const flag = $("[data-edited]");
    if (flag) flag.hidden = false;
  } catch (e) {
    // no content doc, or offline. The page already has its built in copy.
  }
}

function mountAdmin() {
  const area = $("#md"), preview = $("#preview"), note = $("#adminNote");
  let key = "faq";

  const draw = () => { if (preview) preview.innerHTML = renderMarkdown(area.value); };

  $$("[data-doc]").forEach(btn => btn.addEventListener("click", async () => {
    key = btn.getAttribute("data-doc");
    $$("[data-doc]").forEach(b => b.classList.toggle("on", b === btn));
    area.value = "Loading...";
    try {
      const snap = await getDoc(doc(db, "content", key));
      area.value = snap.exists() ? (snap.data().markdown || "") : "";
      when(note, "");
    } catch (e) { when(note, friendly(e), true); area.value = ""; }
    draw();
  }));

  area && area.addEventListener("input", draw);

  $("#saveContent") && $("#saveContent").addEventListener("click", async () => {
    try {
      await setDoc(doc(db, "content", key), {
        markdown: area.value,
        updatedAt: serverTimestamp(),
        updatedBy: displayName() || state.user.uid
      });
      when(note, "Saved. The " + key + " page is live.");
    } catch (e) { when(note, friendly(e), true); }
  });

  $("#clearContent") && $("#clearContent").addEventListener("click", async () => {
    if (!confirm("Clear this page back to the built in text?")) return;
    try {
      await setDoc(doc(db, "content", key), {
        markdown: "", updatedAt: serverTimestamp(), updatedBy: displayName() || state.user.uid
      });
      area.value = "";
      draw();
      when(note, "Cleared. The built in text shows again.");
    } catch (e) { when(note, friendly(e), true); }
  });

  refresh.push(() => {
    if (!state.ready) return;
    if (!state.user) { location.replace("account.html?next=admin.html"); return; }
    if (!isOwner()) {
      const gate = $("#adminGate");
      if (gate) gate.hidden = false;
      const tool = $("#adminTool");
      if (tool) tool.hidden = true;
      return;
    }
    const gate = $("#adminGate");
    if (gate) gate.hidden = true;
    const tool = $("#adminTool");
    if (tool && tool.hidden) {
      tool.hidden = false;
      const first = $('[data-doc="faq"]');
      if (first) first.click();
    }
  });
}

// ------------------------------------------------------------------ boot

function route() {
  const p = page();
  mountNav();
  if (p === "account.html") mountAccount();
  if (p === "report.html") mountReportForm();
  if (p === "reports.html") mountReports();
  if (p === "admin.html") mountAdmin();
  if (p === "faq.html") loadContent("faq", "#faqBody");
  if (p === "wiki.html") loadContent("wiki", "#wikiBody", ".wiki-nav");
}

onAuthStateChanged(auth, async user => {
  state.user = user;
  state.profile = null;
  if (user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      state.profile = snap.exists()
        ? snap.data()
        : { email: user.email, mcName: "", role: "user" };
      if (!snap.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email, mcName: "", role: "user", createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      state.profile = { email: user.email, mcName: "", role: "user" };
    }
  }
  state.ready = true;
  rerender();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { route(); rerender(); });
} else {
  route();
  rerender();
}
