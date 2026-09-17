/* Paper Fight Bot. Change CONFIG and every page follows. */

const CONFIG = {
  version:  "4.9.0-beta",
  downloads: "1.2K",
  tested:   "1.21.11",
  modrinth: "https://modrinth.com/plugin/paper-fight-bot",
  discord:  "https://discord.gg/Gc3TDyFup5",
  libs:     "https://www.spigotmc.org/resources/libs-disguises-free.81/"
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-version]").forEach(el => el.textContent = CONFIG.version);
  document.querySelectorAll("[data-downloads]").forEach(el => el.textContent = CONFIG.downloads);
  document.querySelectorAll("[data-tested]").forEach(el => el.textContent = CONFIG.tested);

  document.querySelectorAll("[data-modrinth]").forEach(el => el.href = CONFIG.modrinth);
  document.querySelectorAll("[data-discord]").forEach(el => el.href = CONFIG.discord);
  document.querySelectorAll("[data-libs]").forEach(el => el.href = CONFIG.libs);

  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".bar nav a").forEach(a => {
    const href = a.getAttribute("href");
    if (href && href.toLowerCase() === here) a.setAttribute("aria-current", "page");
  });

  document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());

  // auth runs on every page so the sign in pill sits in the nav everywhere.
  // account.html loads it itself, so skip the duplicate there.
  if (!document.querySelector('script[src$="auth.js"]')) {
    const s = document.createElement("script");
    s.src = "assets/auth.js";
    document.body.appendChild(s);
  }
});
