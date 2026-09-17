/* Paper Fight Bot — accounts.
   ---------------------------------------------------------------------------
   Nothing here is switched on yet. The page renders a disabled sign-in card
   until you fill this in, so you can ship the site today and add logins later.

   TO TURN IT ON
   1. Make a project at console.firebase.google.com.
   2. Authentication -> Sign-in method -> enable Google (and Email/Password
      if you want it).
   3. Project settings -> Your apps -> Web -> copy the config values below.
   4. Set enabled: true.
   5. In Firebase, add fightmc.xyz under Authentication -> Settings ->
      Authorized domains, or sign-in will be blocked.
   6. Uncomment the two import lines in boot() below.

   WHAT TO STORE (suggested Firestore shape, when you get there)
     users/{uid} = {
       mcName:   "nolaniscool",   // linked Minecraft username
       mcUuid:   "...",           // filled in once they verify in-game
       joined:   <timestamp>,
       kit:      "sword",         // last used kit preset
       wins: 0, losses: 0, streak: 0
     }
   Verify ownership of a Minecraft name by having the player run a command
   in-game that shows a short code, then typing that code on the site.
   Never trust a username someone just types in.
   --------------------------------------------------------------------------- */

const FIREBASE = {
  enabled: false,
  config: {
    apiKey:            "",
    authDomain:        "",   // usually fightmc.firebaseapp.com
    projectId:         "",
    storageBucket:     "",
    messagingSenderId: "",
    appId:             ""
  }
};

const Auth = {
  user: null,
  _watchers: [],

  async boot() {
    if (!FIREBASE.enabled) { this._emit(null); return false; }

    // const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    // const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut }
    //   = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    // this._app  = initializeApp(FIREBASE.config);
    // this._auth = getAuth(this._app);
    // this._google = new GoogleAuthProvider();
    // this._signInWithPopup = signInWithPopup;
    // this._signOut = signOut;
    // onAuthStateChanged(this._auth, u => { this.user = u; this._emit(u); });
    return true;
  },

  async signIn() {
    if (!FIREBASE.enabled) return;
    // return this._signInWithPopup(this._auth, this._google);
  },

  async signOut() {
    if (!FIREBASE.enabled) return;
    // return this._signOut(this._auth);
  },

  onUser(fn) { this._watchers.push(fn); if (this.user !== undefined) fn(this.user); },
  _emit(u)   { this._watchers.forEach(fn => fn(u)); }
};

document.addEventListener("DOMContentLoaded", () => {
  Auth.boot();

  Auth.onUser(user => {
    const out = document.querySelector("[data-signed-out]");
    const inn = document.querySelector("[data-signed-in]");
    if (!out || !inn) return;
    out.hidden = !!user;
    inn.hidden = !user;
    if (user) {
      const n = document.querySelector("[data-user-name]");
      if (n) n.textContent = user.displayName || user.email || "Player";
    }
  });

  document.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", () => Auth.signIn()));
  document.querySelectorAll("[data-signout]").forEach(b => b.addEventListener("click", () => Auth.signOut()));
});
