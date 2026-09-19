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
import { DEFAULT_FAQ, DEFAULT_WIKI } from "./defaults.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup
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
  if (code.includes("popup-closed")) return "Sign in window closed before it finished.";
  if (code.includes("popup-blocked")) return "Your browser blocked the popup. Allow popups and try again.";
  if (code.includes("operation-not-allowed")) return "That sign in method is not switched on in Firebase yet.";
  if (code.includes("account-exists-with-different-credential")) {
    return "That email already has an account made a different way. Sign in with the other method.";
  }
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

  const go = () => {
    if (next && /^[a-z0-9._-]+\.html$/i.test(next)) location.href = next;
  };

  // two panels: signing in, and making an account. Swapping between them
  // never asks for anything you have not been shown a box for.
  const signInPanel = $("#signInPanel");
  const registerPanel = $("#registerPanel");
  const show = which => {
    if (signInPanel) signInPanel.hidden = which !== "signin";
    if (registerPanel) registerPanel.hidden = which !== "register";
  };
  $("#showRegister") && $("#showRegister").addEventListener("click", () => show("register"));
  $("#showSignIn") && $("#showSignIn").addEventListener("click", () => show("signin"));

  const note = $("#authNote"), regNote = $("#regNote");

  // ---- google
  const google = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureProfile(cred.user);
      when(note, ""); when(regNote, "");
      go();
    } catch (e) { when(note, friendly(e), true); when(regNote, friendly(e), true); }
  };
  $$("[data-google]").forEach(b => b.addEventListener("click", google));

  // ---- email in
  const email = $("#email"), pass = $("#password");
  const onSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email.value.trim(), pass.value);
      when(note, "");
      go();
    } catch (e) { when(note, friendly(e), true); }
  };
  $("#signIn") && $("#signIn").addEventListener("click", onSignIn);
  pass && pass.addEventListener("keydown", e => { if (e.key === "Enter") onSignIn(); });

  $("#reset") && $("#reset").addEventListener("click", async () => {
    if (!email.value.trim()) return when(note, "Put your email in first.", true);
    try {
      await sendPasswordResetEmail(auth, email.value.trim());
      when(note, "Reset email sent. Check your inbox.");
    } catch (e) { when(note, friendly(e), true); }
  });

  // ---- register
  const rUser = $("#regUser"), rEmail = $("#regEmail"), rPass = $("#regPassword");
  $("#createAccount") && $("#createAccount").addEventListener("click", async () => {
    const mc = (rUser.value || "").trim();
    if (mc && !/^[A-Za-z0-9_]{3,16}$/.test(mc)) {
      return when(regNote, "Minecraft name is three to sixteen letters, numbers or underscores.", true);
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, rEmail.value.trim(), rPass.value);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email, mcName: mc, role: "user", createdAt: serverTimestamp()
      });
      when(regNote, "");
      go();
    } catch (e) { when(regNote, friendly(e), true); }
  });
  rPass && rPass.addEventListener("keydown", e => {
    if (e.key === "Enter") $("#createAccount").click();
  });

  $$("[data-signout]").forEach(b => b.addEventListener("click", () => signOut(auth)));

  // ---- minecraft name, once signed in
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
    if (!state.user) { show("signin"); return; }

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
    const nudge = $("[data-name-nudge]");
    if (nudge) nudge.hidden = !!mc;
  });
}

/** Google gives us no Minecraft name, so make the record if it is missing. */
async function ensureProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    email: user.email || "", mcName: "", role: "user", createdAt: serverTimestamp()
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

const uid = () => Math.random().toString(36).slice(2, 9);

/** Reads a content doc, coping with the old single blob format. */
async function readContent(key) {
  try {
    const snap = await getDoc(doc(db, "content", key));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    return null;
  }
}

// ---- the public FAQ page
async function renderFaq() {
  const host = $("#faqBody");
  if (!host) return;
  const data = await readContent("faq");

  // an older single blob, from before entries existed
  if (data && !Array.isArray(data.items) && data.markdown && data.markdown.trim()) {
    host.innerHTML = renderMarkdown(data.markdown);
    flagEdited();
    return;
  }

  const items = data && Array.isArray(data.items) && data.items.length
    ? data.items : DEFAULT_FAQ;
  if (data && Array.isArray(data.items) && data.items.length) flagEdited();

  host.innerHTML = '<div class="qa">' + items.map(it => `
      <details>
        <summary>${escapeText(it.q)}</summary>
        ${renderMarkdown(it.a, { headings: false })}
      </details>`).join("") + "</div>";
}

// ---- the public wiki page
async function renderWiki() {
  const body = $("#wikiBody");
  if (!body) return;
  const data = await readContent("wiki");
  const nav = $(".wiki-nav");

  if (data && !Array.isArray(data.sections) && data.markdown && data.markdown.trim()) {
    body.innerHTML = renderMarkdown(data.markdown);
    if (nav) nav.hidden = true;
    flagEdited();
    return;
  }

  const sections = data && Array.isArray(data.sections) && data.sections.length
    ? data.sections : DEFAULT_WIKI;
  if (data && Array.isArray(data.sections) && data.sections.length) flagEdited();

  body.innerHTML = sections.map(sec => `
      <h2 id="${sec.id}">${escapeText(sec.title)}</h2>
      ${renderMarkdown(sec.body)}`).join("");
  if (nav) {
    nav.innerHTML = sections
      .map(sec => `<a href="#${sec.id}">${escapeText(sec.title)}</a>`).join("");
  }
}

function escapeText(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function flagEdited() {
  // the "maintained by the owner" banner was removed, nothing to do
}

// ---- the owner's editor
function mountAdmin() {
  const note = $("#adminNote");
  let key = "faq";
  let items = [];          // faq: {id,q,a}   wiki: {id,title,body}

  const isFaq = () => key === "faq";
  const host = () => $("#itemList");

  async function load() {
    const data = await readContent(key);
    items = [];
    if (data) {
      if (isFaq() && Array.isArray(data.items)) items = data.items.slice();
      if (!isFaq() && Array.isArray(data.sections)) items = data.sections.slice();

      // an older single blob becomes one starter entry rather than vanishing
      if (!items.length && data.markdown && data.markdown.trim()) {
        items = isFaq()
          ? [{ id: uid(), q: "Imported", a: data.markdown }]
          : [{ id: uid(), title: "Imported", body: data.markdown }];
        when(note, "Your earlier text was brought in as one entry. Split it up as you like.");
      }
    }
    // nothing saved yet, so start from what the site already shows. Adding an
    // entry then adds to that list instead of replacing the whole page.
    if (!items.length) items = (isFaq() ? DEFAULT_FAQ : DEFAULT_WIKI).map(x => Object.assign({}, x));
    draw();
  }

  function draw(openId) {
    const wrap = host();
    if (!wrap) return;
    if (!items.length) {
      wrap.innerHTML = '<p class="lede">Nothing here yet. The page shows its built in text until you add something.</p>';
      return;
    }
    wrap.innerHTML = items.map((it, idx) => {
      const title = isFaq() ? it.q : it.title;
      const open = it.id === openId;
      return `
      <div class="ed-item" data-id="${it.id}">
        <div class="ed-head">
          <span class="ed-title">${escapeText(title) || "<em>untitled</em>"}</span>
          <span class="ed-tools">
            <button class="ed-btn" data-up="${it.id}" title="Move up" ${idx === 0 ? "disabled" : ""}>&uarr;</button>
            <button class="ed-btn" data-down="${it.id}" title="Move down" ${idx === items.length - 1 ? "disabled" : ""}>&darr;</button>
            <button class="ed-btn" data-edit="${it.id}">Edit</button>
            <button class="ed-btn danger" data-del="${it.id}">Delete</button>
          </span>
        </div>
        <div class="ed-body" ${open ? "" : "hidden"}>
          <label>${isFaq() ? "Question" : "Section title"}</label>
          <input class="ed-input" data-field="title" value="${escapeAttr(title)}">
          <label>${isFaq() ? "Answer" : "Section text"}</label>
          <textarea class="ed-input mono" data-field="body" rows="10">${escapeText(isFaq() ? it.a : it.body)}</textarea>
          <p class="hint">${isFaq()
            ? "Markdown works. Headings are off here, the question is already the heading."
            : "Markdown works, headings included. Use # for sub headings inside the section."}</p>
          <div class="cta-row" style="margin-top:6px">
            <button class="btn" data-save="${it.id}" type="button">Save</button>
            <button class="btn ghost" data-close="${it.id}" type="button">Close</button>
          </div>
          <div class="preview" data-preview style="margin-top:16px"></div>
        </div>
      </div>`;
    }).join("");
    wire();
  }

  function escapeAttr(s) {
    return escapeText(s).replace(/"/g, "&quot;");
  }

  function find(id) { return items.find(x => x.id === id); }

  function wire() {
    const wrap = host();
    wrap.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => {
      draw(b.getAttribute("data-edit"));
      livePreview(b.getAttribute("data-edit"));
    }));
    wrap.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => draw()));

    wrap.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
      const it = find(b.getAttribute("data-del"));
      const label = isFaq() ? it.q : it.title;
      if (!confirm("Delete \"" + (label || "this entry") + "\"?")) return;
      items = items.filter(x => x.id !== it.id);
      await persist();
      draw();
    }));

    wrap.querySelectorAll("[data-up],[data-down]").forEach(b => b.addEventListener("click", async () => {
      const up = b.hasAttribute("data-up");
      const id = b.getAttribute(up ? "data-up" : "data-down");
      const i = items.findIndex(x => x.id === id);
      const j = up ? i - 1 : i + 1;
      if (j < 0 || j >= items.length) return;
      const tmp = items[i]; items[i] = items[j]; items[j] = tmp;
      await persist();
      draw();
    }));

    wrap.querySelectorAll("[data-save]").forEach(b => b.addEventListener("click", async () => {
      const id = b.getAttribute("data-save");
      const box = wrap.querySelector('.ed-item[data-id="' + id + '"]');
      const title = box.querySelector('[data-field="title"]').value.trim();
      const body = box.querySelector('[data-field="body"]').value;
      if (!title) return when(note, isFaq() ? "The question cannot be empty." : "The section needs a title.", true);
      const it = find(id);
      if (isFaq()) { it.q = title; it.a = body; }
      else { it.title = title; it.body = body; it.id = it.id || uid(); }
      await persist();
      draw();
    }));

    wrap.querySelectorAll('[data-field="body"]').forEach(area => {
      area.addEventListener("input", () => {
        const box = area.closest(".ed-item");
        const prev = box.querySelector("[data-preview]");
        if (prev) prev.innerHTML = renderMarkdown(area.value, { headings: !isFaq() });
      });
    });
  }

  function livePreview(id) {
    const box = host().querySelector('.ed-item[data-id="' + id + '"]');
    if (!box) return;
    const area = box.querySelector('[data-field="body"]');
    const prev = box.querySelector("[data-preview]");
    if (area && prev) prev.innerHTML = renderMarkdown(area.value, { headings: !isFaq() });
  }

  async function persist() {
    try {
      const payload = {
        updatedAt: serverTimestamp(),
        updatedBy: displayName() || state.user.uid,
        markdown: ""            // clear the old format so it cannot come back
      };
      if (isFaq()) payload.items = items;
      else payload.sections = items;
      await setDoc(doc(db, "content", key), payload);
      when(note, "Saved. The " + key + " page is live.");
    } catch (e) {
      when(note, friendly(e), true);
    }
  }

  /**
   * Accepts either JSON from the export button, or plain Markdown where every
   * "## heading" starts a new entry. Returns entries, or throws.
   */
  function parseImport(text) {
    const t = (text || "").trim();
    if (!t) throw new Error("Nothing to import.");

    if (t.startsWith("[") || t.startsWith("{")) {
      const data = JSON.parse(t);
      const arr = Array.isArray(data) ? data : (data.items || data.sections);
      if (!Array.isArray(arr) || !arr.length) throw new Error("No entries in that JSON.");
      return arr.map(raw => {
        const title = raw.q || raw.title || raw.question || raw.name || "";
        const body = raw.a || raw.body || raw.answer || raw.text || "";
        if (!title) throw new Error("An entry has no question or title.");
        return isFaq()
          ? { id: raw.id || uid(), q: String(title), a: String(body) }
          : { id: raw.id || uid(), title: String(title), body: String(body) };
      });
    }

    // markdown: each heading starts an entry, everything under it is the body
    const lines = t.replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let cur = null;
    for (const line of lines) {
      const h = line.match(/^#{1,3}\s+(.*)$/);
      if (h) {
        if (cur) out.push(cur);
        cur = { title: h[1].trim(), body: [] };
      } else if (cur) {
        cur.body.push(line);
      }
    }
    if (cur) out.push(cur);
    if (!out.length) throw new Error("No headings found. Start each entry with ## followed by its title.");

    return out.map(e => {
      const body = e.body.join("\n").trim();
      return isFaq()
        ? { id: uid(), q: e.title, a: body }
        : { id: uid(), title: e.title, body: body };
    });
  }

  $("#doImport") && $("#doImport").addEventListener("click", async () => {
    const box = $("#importText");
    const add = $("#importAppend") && $("#importAppend").checked;
    try {
      const parsed = parseImport(box.value);
      items = add ? items.concat(parsed) : parsed;
      await persist();
      draw();
      box.value = "";
      when(note, (add ? "Added " : "Imported ") + parsed.length + " entr"
        + (parsed.length === 1 ? "y" : "ies") + ".");
    } catch (e) {
      when(note, e.message || "Could not read that.", true);
    }
  });

  $("#doExport") && $("#doExport").addEventListener("click", () => {
    const payload = isFaq() ? { items } : { sections: items };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = key + "-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    when(note, "Downloaded, and copied to your clipboard.");
  });

  $("#restoreDefaults") && $("#restoreDefaults").addEventListener("click", async () => {
    if (!confirm("Put the built in " + key + " back? Anything you have written here is replaced.")) return;
    items = (isFaq() ? DEFAULT_FAQ : DEFAULT_WIKI).map(x => Object.assign({}, x));
    await persist();
    draw();
    when(note, "Built in " + key + " restored.");
  });

  $("#addItem") && $("#addItem").addEventListener("click", async () => {
    const entry = isFaq()
      ? { id: uid(), q: "New question", a: "" }
      : { id: uid(), title: "New section", body: "" };
    items.push(entry);
    await persist();
    draw(entry.id);
  });

  $$("[data-doc]").forEach(btn => btn.addEventListener("click", () => {
    key = btn.getAttribute("data-doc");
    $$("[data-doc]").forEach(b => b.classList.toggle("on", b === btn));
    const label = $("#addLabel");
    if (label) label.textContent = isFaq() ? "Add a question" : "Add a section";
    when(note, "");
    load();
  }));

  refresh.push(() => {
    if (!state.ready) return;
    if (!state.user) { location.replace("account.html?next=admin.html"); return; }
    const gate = $("#adminGate"), tool = $("#adminTool");
    if (!isOwner()) {
      if (gate) gate.hidden = false;
      if (tool) tool.hidden = true;
      return;
    }
    if (gate) gate.hidden = true;
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
  if (p === "faq.html") renderFaq();
  if (p === "wiki.html") renderWiki();
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
