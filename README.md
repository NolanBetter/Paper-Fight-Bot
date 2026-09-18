# fightmc.xyz

Static site for Paper Fight Bot. No build step, no framework — plain HTML, one
stylesheet, two scripts.

    index.html      home
    install.html    installation and first fight
    wiki.html       commands, equipment, groups, roaming, patrols, config
    faq.html        common questions
    report.html     bug report form
    reports.html    your reports, and the reply threads
    admin.html      owner only, edits the FAQ and wiki in Markdown
    account.html    accounts (not switched on yet)
    404.html        GitHub Pages 404
    FIREBASE-SETUP.md  how to turn sign in, reports and editing on
    firestore.rules    paste into Firebase console -> Firestore -> Rules
    CNAME           custom domain
    .nojekyll       stops Pages ignoring files starting with _
    assets/
      style.css     all styling
      site.js       CONFIG + shared page wiring
      firebase.js   project config and the auth/firestore handles
      md.js         the Markdown renderer
      app.js        accounts, nav, reports, threads, content editing
      logo.png      the square mark
      wordmark.png  the wide Paper Fight Bot lockup
      banner.png    1200x630, used for Discord and social embeds
      favicon.png

## Changing things

Everything that goes stale lives in `CONFIG` at the top of `assets/site.js`:

    version    shown on the home page
    downloads  the number in the stat strip
    tested     the Minecraft version you last tested against
    modrinth   project link
    discord    invite link
    libs       LibsDisguises link, for the pre-4.1.0 note

Every page reads from it, so you edit one file and the whole site follows.

## Deploying on GitHub Pages

1. Push this folder to a repo.
2. Settings -> Pages -> Source: deploy from branch, `main`, `/ (root)`.
3. Settings -> Pages -> Custom domain: `fightmc.xyz`. The CNAME file is already
   here so it sticks.
4. At your DNS host:

       A     @   185.199.108.153
       A     @   185.199.109.153
       A     @   185.199.110.153
       A     @   185.199.111.153
       CNAME www <your-username>.github.io

5. Tick "Enforce HTTPS" once the certificate is issued.

## Adding logins later

`assets/auth.js` has the whole thing stubbed out with instructions at the top.
Make a Firebase project, paste the config in, flip `enabled` to true and
uncomment the two import lines. `account.html` already has both the signed-out
and signed-in states built, so it starts working as soon as the config is real.

## A note on the copy

The wiki and FAQ were written from the Modrinth description, with two things
corrected: the old line about disguised zombies and LibsDisguises now only
applies to builds below 4.1.0, and the equipment slots 12-14 are described as
held back for mace and crystal rather than "reserved for future features".
If anything else has moved on, those pages are the ones to edit.
