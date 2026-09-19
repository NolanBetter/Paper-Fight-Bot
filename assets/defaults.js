/* The FAQ and wiki that ship with the site, as data.
   ---------------------------------------------------------------------------
   These are what the pages show before anyone edits anything, and what the
   editor starts from. Editing in the browser copies them into Firestore, so
   you are always adding to the real list rather than replacing it with a
   blank one.

   "Restore built in text" in the editor puts these back. */

export const DEFAULT_FAQ = [
  { id: "deps", q: "Does it need any other plugins?",
    a: "Not on 4.1.0 or later. It is one jar with nothing else to install.\n\nOn builds below 4.1.0 you want the free version of [LibsDisguises](https://www.spigotmc.org/resources/libs-disguises-free.81/) alongside it, because that is what makes the bots look like players." },

  { id: "platforms", q: "What can I run it on?",
    a: "Paper, Bukkit, Purpur and Spigot, on Minecraft 1.16 and up. It is tested on 1.21.11." },

  { id: "cost", q: "Does it cost anything?",
    a: "No. It is free on Modrinth." },

  { id: "howmany", q: "How many bots can I run at once?",
    a: "One command spawns up to 50. Whether your server enjoys 50 of them is another matter. They path, fight and place blocks the way players do, so scale up gradually and watch your TPS." },

  { id: "botvbot", q: "Can bots fight each other?",
    a: "Yes. Put them in two groups and set the groups on each other with `/fightbot fight --group A B`. Good for watching what a loadout actually does." },

  { id: "gearmid", q: "Can I change their gear while they are fighting?",
    a: "Not mid fight. Stop the bot first with `/fightbot stop <bot>`, then right click it in creative to open the equipment screen. Once it is fighting again the screen is off limits until you stop it." },

  { id: "drops", q: "Do bots drop their gear when they die?",
    a: "Yes, they drop what they were carrying. Sweep the floor between fights, or gear them with things you do not mind picking up again." },

  { id: "names", q: "Why do the bots have player names?",
    a: "They are pulled from `botnames.yml`, and they show in the tab list, so a bot reads like a real player joining. Edit that file to change the pool." },

  { id: "perm", q: "Is there a permission node?",
    a: "`fightbot.use`, default OP. Grant it to let other people spawn and command bots." },

  { id: "beta", q: "Should I use the beta builds?",
    a: "Only if you are chasing a specific fix or happy to report bugs. Stick to the newest full release for anything you care about, and always back up first." },

  { id: "next", q: "What is coming next?",
    a: "Mace and crystal gear support in the reserved equipment slots, bots potting themselves mid fight, and a proper GUI for the commands. Discord gets the details first." },

  { id: "video", q: "Can I use it in a video?",
    a: "Go ahead. A link back is appreciated but not required." },

  { id: "bug", q: "How do I report a bug?",
    a: "Use the [report form](report.html), or Discord. Either way include your server version, your plugin version, and whatever the console printed. Most updates come straight out of those reports." }
];

export const DEFAULT_WIKI = [
  { id: "commands", title: "Commands", body:
`Everything runs under \`/fightbot\`, shortened to \`/fb\`. The permission is \`fightbot.use\`, which defaults to OP.

# Spawning

| Command | What it does |
|---|---|
| \`/fightbot spawn <name>\` | Spawns one bot with the name you give it, where you are standing. |
| \`/fightbot spawn --random [count]\` | Spawns 1 to 50 bots with random player style names. |

# Fighting

| Command | What it does |
|---|---|
| \`/fightbot fight <bot> <player...>\` | Sends one bot after one or more players. |
| \`/fightbot fight --all <player...>\` | Sends every bot after those players. |
| \`/fightbot fight --group <group> <player...>\` | Sends a whole group after players. |
| \`/fightbot fight --group <A> <B>\` | Sets two groups on each other. Good for watching. |
| \`/fightbot stop <bot|--all>\` | Calls them off. |

# Managing bots

| Command | What it does |
|---|---|
| \`/fightbot list\` | Shows every live bot and group. |
| \`/fightbot remove <bot|--all>\` | Deletes bots. |
| \`/fightbot edit clone <bot> <name|--random>\` | Copies a bot, gear and inventory included, and it joins the fight the original is in. |
| \`/fightbot edit change <bot> <name|--random>\` | Renames a bot. |

# Moving them

| Command | What it does |
|---|---|
| \`/fightbot tp <bot> <player>\` | Teleports a bot to a player. |
| \`/fightbot tp <bot> <x> <y> <z>\` | Teleports a bot to coordinates. |
| \`/fightbot tp --all <player|x y z>\` | Teleports every bot at once. |
| \`/fightbot tp --group <group> <player|x y z>\` | Teleports a group. |` },

  { id: "equipment", title: "Equipment", body:
`Right click any bot **in creative mode** to open its equipment screen. Every slot maps to a behaviour: give the bot the item and it will use it.

| Slots | Contents |
|---|---|
| 1 to 4 | Helmet, chestplate, leggings, boots |
| 5 | Offhand, totem or shield |
| 6 | Main hand, its weapon |
| 7 | Axe, used to break raised shields |
| 8 | Food, for eating and regen |
| 9 | Cobwebs |
| 10 | Ender pearls |
| 11 | Water bucket, for clutching |
| 12 to 14 | Held back for mace and crystal gear |
| 15 and up | Storage, anything the bot picks up lands here |

When a hotbar slot empties mid fight the bot refills it from storage, so stack spare pearls or totems in the back and it keeps going. Slot positions and item behaviour can all be moved around in \`config.yml\`.` },

  { id: "groups", title: "Groups", body:
`Groups let you command several bots at once, and make them retaliate together.

\`\`\`
/fightbot group create redteam
/fightbot group add redteam Kade
/fightbot group list redteam
\`\`\`

| Command | What it does |
|---|---|
| \`/fightbot group create <name>\` | Makes a group. |
| \`/fightbot group add <group> <bot>\` | Puts a bot in it. |
| \`/fightbot group list [group]\` | Lists groups, or one group's members. |
| \`/fightbot group edit remove <group> <bot>\` | Takes a bot out. |
| \`/fightbot group edit change <old> <new>\` | Renames a group. |
| \`/fightbot group remove <group>\` | Deletes it. |

With two groups you can set them on each other and watch, or drop yourself into the middle of one:

\`\`\`
/fightbot fight --group redteam blueteam
\`\`\`` },

  { id: "roaming", title: "Roaming", body:
`Roaming bots wander instead of hunting. They stay peaceful until something hits them.

\`\`\`
/fightbot roam Kade
/fightbot roam --group redteam
/fightbot roam --all
\`\`\`

Hit a roaming bot and it fights back. Hit one that is in a group and **every bot in that group comes for you**, worth knowing before you punch one for fun.` },

  { id: "patrols", title: "Patrols", body:
`Waypoint loops, for bots that walk a route rather than wandering.

| Command | What it does |
|---|---|
| \`/fightbot patrol add <bot>\` | Saves where you are standing as a waypoint. |
| \`/fightbot patrol start <bot>\` | Starts the bot walking the loop. |
| \`/fightbot patrol stop <bot>\` | Stops it. |
| \`/fightbot patrol list <bot>\` | Shows the bot's waypoints. |
| \`/fightbot patrol clear <bot>\` | Wipes them. |` },

  { id: "config", title: "Config", body:
`Two files sit in the plugin's folder:

- \`config.yml\` for bot health, speed, damage, and which equipment slot does what.
- \`botnames.yml\` for the pool that \`--random\` pulls names from.

Edit either, then reload without restarting:

\`\`\`
/fightbot reload
\`\`\`

> One catch. Health, speed and damage changes only apply to bots spawned after the reload. Bots already standing there keep the old values, so clear them if you want the new numbers.

\`\`\`
/fightbot remove --all
/fightbot spawn --random 1
\`\`\`` },

  { id: "trouble", title: "Troubleshooting", body:
`# The plugin will not load

Check your server is on 1.16 or newer. If you are running a build below 4.1.0, install the free LibsDisguises alongside it. Older builds rely on it. From 4.1.0 onward you do not need it.

# Bots look like zombies

Same thing, an old build without LibsDisguises. Update to the newest release and it goes away.

# A bot just stands there

It has not been told to fight anyone. Run \`/fightbot fight <bot> <you>\`. If it is already fighting and still frozen, it probably cannot path to you, so try it on flatter ground first.

# Bots move slowly

Check the speed value in \`config.yml\`, and remember it only applies to newly spawned bots. Clear and respawn after changing it. If it started after updating to a beta, roll back to the last full release and report it with your server version.

# Config changes did nothing

Health, speed and damage only apply to newly spawned bots. Remove the existing ones and spawn fresh.

# Something else

[File a report](report.html) with your server version, your plugin version and anything the console printed.` }
];
