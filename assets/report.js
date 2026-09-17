/* Paper Fight Bot — bug report form.
   ---------------------------------------------------------------------------
   Three ways to send a report. Pick one with REPORTS.mode.

   "copy"      Works today, no backend. Builds a tidy report and copies it to
               the clipboard so the reporter pastes it into Discord. This is
               the default, because it cannot break and cannot be abused.

   "firestore" Needs Firebase, set up in assets/auth.js. Writes each report to
               a "reports" collection. See FIREBASE-SETUP.md.

   "webhook"   A Discord webhook URL. Reports land straight in a channel.
               Fast to set up, but be aware the URL sits in this file and is
               therefore public, so anyone can post to that channel. Use a
               webhook in a private channel that you are happy to delete and
               recreate if it gets abused.
   --------------------------------------------------------------------------- */

const REPORTS = {
  mode: "copy",                 // "copy" | "firestore" | "webhook"
  webhookUrl: "",               // webhook mode only
  collection: "reports"         // firestore mode only
};

const FIELDS = ["mcname", "pluginver", "server", "what", "steps", "console"];

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

/** The report as plain text, which is what gets copied or posted. */
function buildText() {
  const lines = [
    "**Paper Fight Bot bug report**",
    "",
    "**Reporter:** " + (val("mcname") || "not given"),
    "**Plugin version:** " + (val("pluginver") || "not given"),
    "**Server:** " + (val("server") || "not given"),
    "",
    "**What went wrong**",
    val("what") || "not given",
    ""
  ];
  if (val("steps")) {
    lines.push("**Steps to reproduce**", val("steps"), "");
  }
  if (val("console")) {
    lines.push("**Console output**", "```", val("console").slice(0, 1500), "```", "");
  }
  return lines.join("\n");
}

function missing() {
  const gaps = [];
  if (!val("mcname")) gaps.push("your Minecraft name");
  if (!val("pluginver")) gaps.push("the plugin version");
  if (!val("server")) gaps.push("your server software and version");
  if (val("what").length < 15) gaps.push("a bit more detail on what went wrong");
  return gaps;
}

function say(msg, bad) {
  const box = document.getElementById("status");
  if (!box) return;
  box.textContent = msg;
  box.style.color = bad ? "var(--ember)" : "var(--grass)";
  box.hidden = !msg;
}

function remember() {
  try {
    const keep = {};
    FIELDS.forEach(f => keep[f] = val(f));
    sessionStorage.setItem("pfb.report", JSON.stringify(keep));
  } catch (e) {
  }
}

function restore() {
  try {
    const raw = sessionStorage.getItem("pfb.report");
    if (!raw) return;
    const keep = JSON.parse(raw);
    FIELDS.forEach(f => {
      const el = document.getElementById(f);
      if (el && keep[f] && !el.value) el.value = keep[f];
    });
  } catch (e) {
  }
}

async function send() {
  const gaps = missing();
  if (gaps.length) {
    say("Still need " + gaps.join(", ") + ".", true);
    return;
  }

  const text = buildText();

  if (REPORTS.mode === "webhook" && REPORTS.webhookUrl) {
    try {
      const res = await fetch(REPORTS.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.slice(0, 1900) })
      });
      if (!res.ok) throw new Error(res.status);
      say("Sent. Thanks, that goes straight to the bug channel.");
      try { sessionStorage.removeItem("pfb.report"); } catch (e) {}
      return;
    } catch (e) {
      say("Could not send that. Copying it instead so nothing is lost.", true);
      return copyOut(text);
    }
  }

  if (REPORTS.mode === "firestore") {
    try {
      const { getFirestore, collection, addDoc, serverTimestamp } =
        await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const db = getFirestore();
      const payload = { at: serverTimestamp(), text: text };
      FIELDS.forEach(f => payload[f] = val(f));
      await addDoc(collection(db, REPORTS.collection), payload);
      say("Sent. Thanks, that is logged.");
      try { sessionStorage.removeItem("pfb.report"); } catch (e) {}
      return;
    } catch (e) {
      say("Could not save that. Copying it instead so nothing is lost.", true);
      return copyOut(text);
    }
  }

  return copyOut(text);
}

function copyOut(text) {
  const done = () => say("Copied. Paste it into the Discord bug channel.");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => showFallback(text));
  } else {
    showFallback(text);
  }
}

/** Clipboard refused, so show the text for them to select by hand. */
function showFallback(text) {
  const box = document.getElementById("fallback");
  const area = document.getElementById("fallbackText");
  if (!box || !area) return;
  area.value = text;
  box.hidden = false;
  area.focus();
  area.select();
  say("Copy the text below and paste it into Discord.", true);
}

function startReport() {
  // auth.js loads on every page and owns the sign in state. Wait for it.
  const start = () => {
    if (typeof Auth === "undefined") {
      setTimeout(start, 40);
      return;
    }
    if (!Auth.requireSignIn("report.html")) return;

    restore();
    const name = document.getElementById("mcname");
    if (name && !name.value && Auth.mcName) name.value = Auth.mcName;

    const ver = document.getElementById("pluginver");
    if (ver && !ver.value && typeof CONFIG !== "undefined") ver.value = CONFIG.version || "";

    FIELDS.forEach(f => {
      const el = document.getElementById(f);
      if (el) el.addEventListener("input", remember);
    });

    const btn = document.getElementById("sendReport");
    if (btn) {
      btn.addEventListener("click", send);
      if (REPORTS.mode === "copy") {
        btn.textContent = "Copy report for Discord";
      }
    }

    const hint = document.getElementById("modeHint");
    if (hint) {
      hint.textContent = REPORTS.mode === "copy"
        ? "This copies a tidy report to your clipboard to paste into Discord."
        : "This sends your report straight through.";
    }
  };
  start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startReport);
} else {
  startReport();
}
