/* A small Markdown renderer.

   HTML is escaped before anything else runs, so nothing anyone types can
   inject markup. Only the owner can edit content anyway, but a page that
   cannot be made to run someone else's script is worth having regardless.

   Supports what a plugin page needs: headings, bold, italic, inline code,
   fenced code blocks, links, images, unordered and ordered lists, tables,
   blockquotes and horizontal rules. */

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Only http, https and relative links survive. No javascript: urls. */
function safeUrl(url) {
  const clean = url.trim();
  if (/^(https?:\/\/|\/|#|[a-z0-9._-]+\.html)/i.test(clean)) return clean;
  return "#";
}

function inline(text) {
  let out = text;
  // images before links, since the syntax overlaps
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (m, alt, url) => `<img src="${safeUrl(url)}" alt="${alt}">`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (m, label, url) => `<a href="${safeUrl(url)}" rel="noopener">${label}</a>`);
  out = out.replace(/`([^`]+)`/g, '<code class="cmd">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

function tableRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
}

/**
 * opts.headings false turns # lines into bold paragraphs instead of headings.
 * FAQ answers use that, because the question is already the heading.
 */
export function renderMarkdown(src, opts) {
  if (!src) return "";
  const allowHeadings = !opts || opts.headings !== false;
  const lines = escapeHtml(src.replace(/\r\n?/g, "\n")).split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (/^```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push("<pre>" + body.join("\n") + "</pre>");
      continue;
    }

    // horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      out.push('<hr style="border:0;border-top:3px solid #000;margin:32px 0">');
      i++;
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      if (allowHeadings) {
        const level = Math.min(4, h[1].length + 1);   // # becomes h2, page owns h1
        out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      } else {
        out.push(`<p><strong>${inline(h[2])}</strong></p>`);
      }
      i++;
      continue;
    }

    // table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length
        && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = tableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(tableRow(lines[i++]));
      out.push('<div class="tw"><table><thead><tr>'
        + head.map(c => `<th>${inline(c)}</th>`).join("")
        + "</tr></thead><tbody>"
        + rows.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("")
        + "</tbody></table></div>");
      continue;
    }

    // blockquote. HTML is escaped before this runs, so the marker is &gt;
    if (/^&gt;\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        body.push(lines[i++].replace(/^&gt;\s?/, ""));
      }
      out.push(`<div class="note">${inline(body.join(" "))}</div>`);
      continue;
    }

    // lists
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i++].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ""));
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>` + items.map(t => `<li>${inline(t)}</li>`).join("") + `</${tag}>`);
      continue;
    }

    // blank
    if (!line.trim()) { i++; continue; }

    // paragraph
    const para = [];
    while (i < lines.length && lines[i].trim()
           && !/^(#{1,4}\s|```|&gt;\s?|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i])
           && !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i])
           && !/^\s*\|.*\|\s*$/.test(lines[i])) {
      para.push(lines[i++]);
    }
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}
