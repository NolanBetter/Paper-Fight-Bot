/* Paper Fight Bot — accounts.
   ---------------------------------------------------------------------------
   Two halves, and the second one works today.

   1. SIGN IN (Google and Discord) needs Firebase. Off until you fill in the
      config below, and the buttons stay disabled until then.

   2. YOUR MINECRAFT NAME and head already work, stored in the browser. Set it
      on the account page and it shows in the nav on every page. Once Firebase
      is on it can move onto the account instead, so it follows you between
      devices.

   ---------------------------------------------------------------------------
   TURNING SIGN IN ON

   Google is the easy one:
     1. console.firebase.google.com, make a project.
     2. Authentication -> Sign-in method -> enable Google.
     3. Project settings -> Your apps -> Web -> copy the values into
        FIREBASE.config below.
     4. Authentication -> Settings -> Authorized domains -> add fightmc.xyz.
     5. Set FIREBASE.enabled to true and uncomment the imports in boot().

   Discord is NOT a provider Firebase ships with, so pick one:

     a) Identity Platform, which needs the Blaze plan. Add Discord as a
        generic OIDC provider, then set DISCORD.mode to "oidc" and
        DISCORD.providerId to the id Firebase gives you. Least code.

     b) A Cloud Function. Send the user to Discord's OAuth2 screen, swap the
        code for a Discord profile inside the function, mint a Firebase custom
        token, and sign in with signInWithCustomToken. Set DISCORD.mode to
        "custom" and DISCORD.endpoint to the function URL. More work, but no
        paid plan.

   Until one of those exists the Discord button says so rather than pretending
   to work.
   --------------------------------------------------------------------------- */

const FIREBASE = {
  enabled: false,
  config: {
    apiKey:            "",
    authDomain:        "",   // usually something.firebaseapp.com
    projectId:         "",
    storageBucket:     "",
    messagingSenderId: "",
    appId:             ""
  }
};

const DISCORD = {
  mode: "off",        // "off" | "oidc" | "custom"
  providerId: "",     // oidc mode, e.g. "oidc.discord"
  endpoint: ""        // custom mode, your function URL
};

/* Head images. Both services take a username. */
const HEADS = {
  primary: (name, size) => "https://mc-heads.net/avatar/" + encodeURIComponent(name) + "/" + size,
  fallback: (name, size) => "https://minotar.net/helm/" + encodeURIComponent(name) + "/" + size + ".png"
};

const MC_KEY = "pfb.mcname";

const Auth = {
  user: null,
  mcName: null,
  _watchers: [],

  // ------------------------------------------------------------- minecraft

  loadName() {
    try {
      this.mcName = localStorage.getItem(MC_KEY) || null;
    } catch (e) {
      this.mcName = null;
    }
    return this.mcName;
  },

  /** Minecraft usernames are 3 to 16 letters, digits or underscores. */
  validName(name) {
    return typeof name === "string" && /^[A-Za-z0-9_]{3,16}$/.test(name.trim());
  },

  saveName(name) {
    const clean = (name || "").trim();
    if (!this.validName(clean)) return false;
    this.mcName = clean;
    try {
      localStorage.setItem(MC_KEY, clean);
    } catch (e) {
      /* private browsing, keep it in memory only */
    }
    this._emit();
    return true;
  },

  clearName() {
    this.mcName = null;
    try {
      localStorage.removeItem(MC_KEY);
    } catch (e) {
    }
    this._emit();
  },

  /**
   * Points an img at a head. Tries the second service if the first fails,
   * then gives up and hides the image rather than leaving a broken one.
   */
  paintHead(img, name, size) {
    if (!img || !name) return;
    const px = size || 64;
    img.alt = name + "'s Minecraft head";
    img.style.display = "";
    img.onerror = () => {
      img.onerror = () => {
        img.onerror = null;
        img.style.display = "none";
      };
      img.src = HEADS.fallback(name, px);
    };
    img.src = HEADS.primary(name, px);
  },

  // ------------------------------------------------------------------ boot

  async boot() {
    this.loadName();
    if (!FIREBASE.enabled) {
      this._emit();
      return false;
    }

    // const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    // const { getAuth, onAuthStateChanged, GoogleAuthProvider, OAuthProvider,
    //         signInWithPopup, signInWithCustomToken, signOut }
    //   = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    // this._app  = initializeApp(FIREBASE.config);
    // this._auth = getAuth(this._app);
    // this._google = new GoogleAuthProvider();
    // this._OAuthProvider = OAuthProvider;
    // this._signInWithPopup = signInWithPopup;
    // this._signInWithCustomToken = signInWithCustomToken;
    // this._signOut = signOut;
    // onAuthStateChanged(this._auth, u => { this.user = u; this._emit(); });
    return true;
  },

  googleReady() { return FIREBASE.enabled; },
  discordReady() { return FIREBASE.enabled && DISCORD.mode !== "off"; },

  async signInGoogle() {
    if (!this.googleReady()) return;
    // return this._signInWithPopup(this._auth, this._google);
  },

  async signInDiscord() {
    if (!this.discordReady()) return;
    // if (DISCORD.mode === "oidc") {
    //   const provider = new this._OAuthProvider(DISCORD.providerId);
    //   return this._signInWithPopup(this._auth, provider);
    // }
    // if (DISCORD.mode === "custom") {
    //   const res = await fetch(DISCORD.endpoint, { credentials: "include" });
    //   const { token } = await res.json();
    //   return this._signInWithCustomToken(this._auth, token);
    // }
  },

  async signOut() {
    if (!FIREBASE.enabled) return;
    // return this._signOut(this._auth);
  },

  /** The only identity that exists today is a linked Minecraft name. */
  signedIn() {
    return !!(this.user || this.mcName);
  },

  displayName() {
    if (this.mcName) return this.mcName;
    if (this.user) return this.user.displayName || this.user.email || "there";
    return null;
  },

  /** Bounces to the account page, remembering where you were headed. */
  requireSignIn(here) {
    if (this.signedIn()) return true;
    const next = here || (location.pathname.split("/").pop() || "");
    location.replace("account.html?next=" + encodeURIComponent(next));
    return false;
  },

  onChange(fn) {
    this._watchers.push(fn);
    fn(this.user, this.mcName);
  },

  _emit() {
    this._watchers.forEach(fn => fn(this.user, this.mcName));
  }
};

/* ----------------------------------------------- the sign in pill in the nav */

const HEAD_PX = 24;

function mountNavWidget() {
  const nav = document.querySelector(".bar nav");
  if (!nav || nav.querySelector(".auth")) return;

  // Report sits before the pill, and only once there is someone to report as.
  const report = document.createElement("a");
  report.href = "report.html";
  report.textContent = "Report";
  report.hidden = true;
  nav.appendChild(report);

  const pill = document.createElement("a");
  pill.className = "auth";
  pill.href = "account.html";

  // Sizing is set here as well as in the stylesheet on purpose. If style.css
  // is stale or cached, the head would otherwise render at full size and shove
  // the rest of the nav off screen.
  pill.style.cssText = "display:inline-flex;align-items:center;gap:8px;flex:none;" +
      "white-space:nowrap;text-decoration:none;line-height:1";
  nav.appendChild(pill);

  Auth.onChange(() => {
    const name = Auth.displayName();
    report.hidden = !Auth.signedIn();
    pill.textContent = "";

    if (!name) {
      pill.textContent = "Sign in";
      pill.title = "Sign in";
      return;
    }

    if (Auth.mcName) {
      const img = document.createElement("img");
      img.width = HEAD_PX;
      img.height = HEAD_PX;
      img.style.cssText = "width:" + HEAD_PX + "px;height:" + HEAD_PX + "px;" +
          "image-rendering:pixelated;display:block;flex:none";
      Auth.paintHead(img, Auth.mcName, 64);
      pill.appendChild(img);
    }
    const who = document.createElement("span");
    who.className = "who";
    who.style.cssText = "max-width:13ch;overflow:hidden;text-overflow:ellipsis";
    who.textContent = name;
    pill.appendChild(who);
    pill.title = "Your account";
  });
}

/* ------------------------------------------------------------ account page */

function mountAccountPage() {
  const out = document.querySelector("[data-signed-out]");
  const why = document.querySelector("[data-why]");
  if (why) {
    const next = new URLSearchParams(location.search).get("next");
    if (next) {
      why.textContent = "Set your Minecraft name below and you can carry on to " + next + ".";
      why.hidden = false;
    }
  }
  const inn = document.querySelector("[data-signed-in]");
  const nameInput = document.querySelector("[data-mc-input]");
  const setBtn = document.querySelector("[data-mc-set]");
  const clearBtn = document.querySelector("[data-mc-clear]");
  const card = document.querySelector("[data-mc-card]");
  const cardHead = document.querySelector("[data-mc-head]");
  const cardName = document.querySelector("[data-mc-name]");
  const note = document.querySelector("[data-mc-note]");

  const google = document.querySelector("[data-signin-google]");
  const discord = document.querySelector("[data-signin-discord]");

  if (google) {
    google.disabled = !Auth.googleReady();
    google.addEventListener("click", () => Auth.signInGoogle());
  }
  if (discord) {
    discord.disabled = !Auth.discordReady();
    discord.addEventListener("click", () => Auth.signInDiscord());
    if (!Auth.discordReady()) discord.title = "Discord sign in is not set up yet, see assets/auth.js";
  }
  document.querySelectorAll("[data-signout]").forEach(b =>
    b.addEventListener("click", () => Auth.signOut()));

  if (setBtn && nameInput) {
    setBtn.addEventListener("click", () => {
      if (Auth.saveName(nameInput.value)) {
        if (note) note.textContent = "";
        const next = new URLSearchParams(location.search).get("next");
        if (next && /^[a-z0-9._-]+\.html$/i.test(next)) location.href = next;
      } else if (note) {
        note.textContent = "That is not a Minecraft username. Three to sixteen letters, numbers or underscores.";
      }
    });
    nameInput.addEventListener("keydown", e => {
      if (e.key === "Enter") setBtn.click();
    });
  }
  if (clearBtn) clearBtn.addEventListener("click", () => Auth.clearName());

  Auth.onChange((user, mcName) => {
    if (out) out.hidden = !!user;
    if (inn) inn.hidden = !user;
    if (user) {
      const n = document.querySelector("[data-user-name]");
      if (n) n.textContent = user.displayName || user.email || "there";
    }
    if (card) card.hidden = !mcName;
    if (mcName) {
      Auth.paintHead(cardHead, mcName, 128);
      if (cardName) cardName.textContent = mcName;
      if (nameInput) nameInput.value = mcName;
    } else if (nameInput) {
      nameInput.value = "";
    }
  });
}

/* This file is sometimes injected by site.js after DOMContentLoaded has
   already fired, in which case listening for it would never run anything. */
function startAuth() {
  Auth.boot().then(() => {
    mountNavWidget();
    mountAccountPage();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startAuth);
} else {
  startAuth();
}
