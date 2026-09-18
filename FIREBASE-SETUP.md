# Turning the account side on

Your project is already wired in. `assets/firebase.js` has the real config for
**pfbwebsite-45ce2**, so there is nothing to paste.

What is left is three things in the Firebase console. Fifteen minutes, and the
site works without any of it — the docs, FAQ and wiki all render on their own.

---

## 1. Email and password sign in

1. Firebase console -> **Authentication** -> **Get started**.
2. **Sign-in method** -> **Email/Password** -> enable -> **Save**.
   Leave "Email link" off, it is not used.
3. **Settings** -> **Authorized domains** -> **Add domain** -> `fightmc.xyz`.

`localhost` is usually there already, which is what lets you test locally.

**Discord is not here on purpose.** It needs OpenID Connect, which Firebase
only offers on Identity Platform, and that is the paid tier. Email and password
does the same job for what this site needs. If you upgrade later, the hook goes
in `app.js` next to the email sign in.

---

## 2. Firestore, and the rules

1. Firebase console -> **Firestore Database** -> **Create database**.
2. Choose **Production mode**. The rules in the next step replace whatever it
   starts with.
3. Pick a region near you. You cannot change it later.
4. **Rules** tab. Delete what is there, paste the whole of `firestore.rules`
   from this repo, and click **Publish**.

Read `firestore.rules` if you want to know exactly what it allows. The summary:

- The FAQ and wiki are readable by anyone, writable only by the owner.
- Signed in people can file reports and reply on their own.
- Only the owner can read every report, change a status, or edit pages.
- **Nobody can make themselves the owner.** The rules require your role to stay
  exactly as it was on every update, so the only way in is step 3.

---

## 3. Make yourself the owner

This is the one manual step, and it is deliberately manual.

1. Open the site and go to **Account**.
2. **Create an account** with your email and a password.
3. Firebase console -> **Firestore Database** -> **Data**.
4. Open the **users** collection. There is one document, named with your user
   id. Open it.
5. Find the **role** field. It says `user`. Click it, change it to `owner`,
   and save.
6. Reload the site. The nav now shows **Reports** and **Edit**.

From then on:

- **Reports** shows every report from everyone, not just yours.
- **Edit** lets you rewrite the FAQ and wiki.

To make someone else staff, change their role the same way. To take it away,
set it back to `user`.

---

## How the pieces behave

### Reports

Someone signs in, fills in the form, and it lands in the **reports**
collection. You see it under Reports, open it, and reply. They see your reply
on their own Reports page, and can reply back. Replying as the owner marks the
report **answered** automatically, and you can set open, answered or closed by
hand.

A reporter can only ever see their own reports. That is enforced by the rules,
not by the page hiding things.

### Editing the FAQ and wiki

**Edit** gives you a Markdown box with a live preview, the same format as the
Modrinth description. Save and it is live immediately.

What is supported: headings, `**bold**`, `*italic*`, `` `code` ``, fenced code
blocks, links, images, bullet and numbered lists, tables, `> quotes` and `---`
rules.

Two things worth knowing:

- **Empty means built in.** Clear a page and the text that ships in the HTML
  comes back. Nothing is ever lost by experimenting.
- **The wiki sidebar disappears** once you write your own wiki text, because
  its links point at the built in headings. Put your own contents list at the
  top if you want one.

Content is stored in **content/faq** and **content/wiki**. Editing those
documents in the console works too, if you would rather.

### Minecraft names

A linked name shows your head in the corner of every page and makes replies
read properly. It is stored on your user document, so it follows you to any
device you sign in on.

It is a **claim, not proof** — anyone can type any username. If that ever
matters, the usual fix is having the plugin print a short code in game that the
player types on the site.

---

## If something does not work

- **Sign in does nothing, no error.** Email/Password is still disabled in step 1.
- **`auth/unauthorized-domain`.** `fightmc.xyz` is missing from Authentication
  -> Settings -> Authorized domains.
- **"You are not allowed to do that" when saving a page.** Your role is still
  `user`. Step 3.
- **Reports list is empty but you filed one.** You are signed in as a different
  account than the one that filed it. Check the email in the nav.
- **"Missing or insufficient permissions".** The rules were not published, or
  only partly pasted. Redo step 2.4 with the whole file.
- **Nothing signed-in works at all and the console mentions gstatic.** An ad
  blocker or network is blocking the Firebase SDK. The docs still work, which
  is why the pages are written to stand on their own.

## What it costs

Nothing, at this scale. The Spark free plan covers 50,000 document reads a day
and unlimited email sign ins. A busy bug tracker for one plugin will not come
close.
