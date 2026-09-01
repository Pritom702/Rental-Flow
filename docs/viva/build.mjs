// ============================================================
//  RentalFlow  |  Viva guide generator
//  Reads every source file plus docs/viva/content.mjs and emits a single
//  self-contained HTML study guide.
//    node docs/viva/build.mjs
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  meta, members, seModel, architecture, features, fileNotes, sharedFiles, qa, readingOrder,
} from './content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'RentalFlow-Viva-Guide.html');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Minimal markdown → HTML for the authored prose (bold, code, tables, lists).
function md(src) {
  const lines = String(src).split('\n');
  const out = [];
  let inList = false, inTable = false;
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    const isTableRow = /^\|.*\|$/.test(line);
    if (isTableRow) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (/^[-: ]+$/.test(cells.join(''))) continue;      // separator row
      if (!inTable) { out.push('<table class="md-table"><tbody>'); inTable = true; }
      const tag = out.length && out[out.length - 1] === '<table class="md-table"><tbody>' ? 'th' : 'td';
      out.push('<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>');
      continue;
    }
    if (inTable) { out.push('</tbody></table>'); inTable = false; }

    if (/^[-*] /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*] /, ''))}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }

    if (!line) { continue; }
    if (/^\d+\. /.test(line)) { out.push(`<p class="numbered">${inline(line)}</p>`); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  if (inTable) out.push('</tbody></table>');
  return out.join('\n');
}

// Wrap English + Bangla into one switchable block.
const bi = (en, bn) => `<div class="bi"><div class="lang-en">${md(en)}</div><div class="lang-bn">${md(bn)}</div></div>`;

function readFile(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

const OWNER_OF = {};
for (const m of members) for (const f of m.owns) OWNER_OF[f] = m;

const langOf = (rel) => {
  const e = path.extname(rel).slice(1);
  return { js: 'javascript', jsx: 'javascript', sql: 'sql', css: 'css', json: 'json' }[e] || 'plaintext';
};

// ---------------------------------------------------------------- code browser
let fileCount = 0, lineCount = 0;
function renderCodeGroups() {
  return readingOrder.map((group) => {
    const items = group.files.map((rel) => {
      const src = readFile(rel);
      if (src == null) return '';
      fileCount += 1;
      const lines = src.split('\n').length;
      lineCount += lines;
      const owner = OWNER_OF[rel];
      const note = fileNotes[rel];
      const shared = sharedFiles[rel];
      const feats = features.filter((f) => f.files.includes(rel)).map((f) => f.id);
      const sharedWho = shared ? [...new Set(shared.parts.map((p) => p.who))] : [];
      const ownerChip = owner
        ? `<span class="chip owner-${owner.id}">${owner.id} · ${esc(owner.nick)}</span>`
        : shared
          ? sharedWho.map((w) => {
            const m = members.find((x) => x.id === w);
            return `<span class="chip owner-${w}">${w} · ${esc(m ? m.nick : '')}</span>`;
          }).join('')
          : '<span class="chip">shared</span>';
      const sharedHtml = shared ? `
  <div class="filenote shared">
    <div class="sharedhead">Co-authored file — know which part is yours</div>
    ${bi(shared.en, shared.bn)}
    <table class="md-table"><tr><th>Who</th><th>Which part</th><th>Feature</th><th>What it does</th></tr>
    ${shared.parts.map((p) => {
        const m = members.find((x) => x.id === p.who);
        return `<tr>
        <td><span class="chip owner-${p.who}">${p.who} · ${esc(m ? m.nick : '')}</span></td>
        <td><code>${esc(p.what)}</code></td>
        <td><span class="chip feat">${esc(p.feat)}</span></td>
        <td>${p.en ? bi(p.en, p.bn) : ''}</td>
      </tr>`;
      }).join('')}
    </table>
  </div>` : '';
      return `
<details class="file" id="file-${rel.replace(/[^a-z0-9]/gi, '-')}" data-search="${esc(rel)} ${esc(owner ? owner.name : sharedWho.join(' '))}">
  <summary>
    <span class="fpath">${esc(rel)}</span>
    <span class="fmeta">
      ${ownerChip}
      ${feats.map((f) => `<span class="chip feat">${f}</span>`).join('')}
      <span class="chip dim">${lines} lines</span>
    </span>
  </summary>
  ${note ? `<div class="filenote">${bi(note.en, note.bn)}</div>` : ''}
  ${sharedHtml}
  <pre><code class="language-${langOf(rel)}">${esc(src)}</code></pre>
</details>`;
    }).join('');
    return `<h3 class="grouphead">${esc(group.group)}</h3>${items}`;
  }).join('');
}
const codeHtml = renderCodeGroups();

// ---------------------------------------------------------------- sections
const membersHtml = members.map((m) => `
<section class="card member" id="member-${m.id}">
  <div class="mhead">
    <span class="mbadge owner-${m.id}">${m.id}</span>
    <div>
      <h3>${esc(m.name)} <span class="dim">(${esc(m.nick)})</span></h3>
      <div class="dim">ID ${esc(m.studentId)} · GitHub @${esc(m.github)} · ${esc(m.area)}</div>
    </div>
  </div>
  <p class="featline">${m.features.map((f) => {
    const ft = features.find((x) => x.id === f);
    return `<span class="chip feat">${f} · ${esc(ft ? ft.title : '')}</span>`;
  }).join('')}</p>
  <h4>How to introduce your part / আপনার অংশ যেভাবে বলবেন</h4>
  ${bi(m.pitchEn, m.pitchBn)}
  <h4>Files you own / আপনার ফাইল</h4>
  <ul class="filelist">${m.owns.map((f) => `<li><code>${esc(f)}</code></li>`).join('')}</ul>
</section>`).join('');

const featuresHtml = features.map((f) => {
  const owner = members.find((m) => m.id === f.owner);
  return `
<section class="card feature" id="feat-${f.id}" data-search="${esc(f.id)} ${esc(f.title)} ${esc(owner ? owner.name : '')}">
  <h3><span class="chip feat">${f.id}</span> ${esc(f.title)}
    <span class="chip owner-${f.owner}">${f.owner} · ${esc(owner ? owner.nick : '')}</span>
    <span class="chip dim">Sprint ${f.sprint}</span>
  </h3>
  ${bi(f.en, f.bn)}
  <div class="where">Where: ${f.files.map((x) => `<code>${esc(x)}</code>`).join(' ')}</div>
</section>`;
}).join('');

const patternsHtml = architecture.patterns.map((p) => `
<tr>
  <td><strong>${esc(p.name)}</strong></td>
  <td><code>${esc(p.whereEn)}</code></td>
  <td>${bi(p.whyEn, p.whyBn)}</td>
</tr>`).join('');

const lifecycleHtml = architecture.lifecycle.map((s) => `
<tr>
  <td class="stepno">${s.step}</td>
  <td><strong>${esc(s.actor)}</strong></td>
  <td>${bi(s.doEn, s.doBn)}</td>
</tr>`).join('');

const qaCats = [...new Set(qa.map((q) => q.cat))];
const qaHtml = qaCats.map((cat) => `
<h3 class="grouphead">${esc(cat)}</h3>
${qa.filter((q) => q.cat === cat).map((q, i) => `
<details class="qa" data-search="${esc(q.q)}">
  <summary><span class="qmark">Q</span>${esc(q.q)}</summary>
  ${bi(q.en, q.bn)}
</details>`).join('')}`).join('');

// ---------------------------------------------------------------- page
const html = `<title>RentalFlow Viva Guide</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<style>
:root{
  --bg:#F7F5F0;--surface:#FFFDF9;--surface-2:#F2EFE8;--border:#E2DDD1;--border-2:#D2CBBB;
  --text:#16150F;--text-2:#3D3A31;--muted:#78736A;--primary:#1F4335;--accent:#9A6534;
  --m1:#2F6350;--m2:#9A6534;--m3:#41586B;--m4:#7D8F62;
  --sans:'Inter','Noto Sans Bengali','Nirmala UI','Shonar Bangla',system-ui,-apple-system,'Segoe UI',sans-serif;
  --serif:'Fraunces','Noto Sans Bengali','Nirmala UI',Georgia,serif;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Consolas,monospace;
  --sidew:290px;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#121210;--surface:#1A1A17;--surface-2:#232320;--border:#2E2E29;--border-2:#3D3D36;
  --text:#EDEAE1;--text-2:#C6C2B7;--muted:#8E8A80;--primary:#8FB6A0;--accent:#C79055;
  --m1:#6FA987;--m2:#C79055;--m3:#7E97AC;--m4:#A3B285;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.62}
h1,h2,h3,h4{font-family:var(--serif);font-weight:600;letter-spacing:-.018em;line-height:1.18;margin:0}
code{font-family:var(--mono);font-size:.88em;background:var(--surface-2);border:1px solid var(--border);
  border-radius:4px;padding:1px 5px}
pre code{display:block;padding:16px;overflow-x:auto;border-radius:8px;line-height:1.55;font-size:12.5px;
  background:var(--surface-2);border:1px solid var(--border)}
pre{margin:12px 0 0}
a{color:var(--primary)}

.layout{display:flex;min-height:100vh}
.side{width:var(--sidew);flex:none;position:sticky;top:0;height:100vh;overflow-y:auto;
  background:var(--surface);border-right:1px solid var(--border);padding:22px 16px}
.side h1{font-size:19px}
.side .tag{font-size:12px;color:var(--muted);margin:3px 0 16px}
.side a{display:block;padding:6px 10px;border-radius:6px;color:var(--text-2);text-decoration:none;font-size:13.5px}
.side a:hover{background:var(--surface-2);color:var(--text)}
.side .navgroup{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);
  font-weight:700;margin:18px 0 5px;padding:0 10px}
main{flex:1;min-width:0;max-width:1120px;margin:0 auto;padding:34px 34px 90px}

.toolbar{position:sticky;top:0;z-index:20;background:var(--bg);padding:10px 0 14px;
  border-bottom:1px solid var(--border);margin-bottom:26px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#q{flex:1;min-width:200px;padding:9px 13px;border:1px solid var(--border-2);border-radius:8px;
  background:var(--surface);color:var(--text);font:inherit;font-size:14px}
#q:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(31,67,53,.18)}
.btn{padding:8px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);
  color:var(--text);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.btn:hover{background:var(--surface-2)}
.btn.on{background:var(--primary);color:var(--bg);border-color:var(--primary)}

section.block{margin-bottom:46px;scroll-margin-top:80px}
section.block>h2{font-size:26px;padding-bottom:9px;border-bottom:2px solid var(--border);margin-bottom:18px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px 22px;margin-bottom:16px;scroll-margin-top:80px}
.card h3{font-size:18px;margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.card h4{font-size:14px;margin:18px 0 6px;color:var(--text-2);font-family:var(--sans);font-weight:700}
p{margin:9px 0}
.dim{color:var(--muted);font-weight:400}
.numbered{margin-left:2px}

.chip{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:11.5px;
  font-weight:700;background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);
  font-family:var(--sans);letter-spacing:.01em}
.chip.dim{font-weight:500;color:var(--muted)}
.chip.feat{background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent);
  border-color:color-mix(in srgb,var(--accent) 30%,transparent)}
.owner-M1{background:color-mix(in srgb,var(--m1) 15%,transparent);color:var(--m1);border-color:color-mix(in srgb,var(--m1) 34%,transparent)}
.owner-M2{background:color-mix(in srgb,var(--m2) 15%,transparent);color:var(--m2);border-color:color-mix(in srgb,var(--m2) 34%,transparent)}
.owner-M3{background:color-mix(in srgb,var(--m3) 15%,transparent);color:var(--m3);border-color:color-mix(in srgb,var(--m3) 34%,transparent)}
.owner-M4{background:color-mix(in srgb,var(--m4) 15%,transparent);color:var(--m4);border-color:color-mix(in srgb,var(--m4) 34%,transparent)}

.mhead{display:flex;gap:14px;align-items:flex-start;margin-bottom:12px}
.mbadge{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  font-family:var(--serif);font-weight:700;font-size:17px;flex:none;border:1px solid}
.featline{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
.filelist{columns:2;font-size:13px;margin:6px 0;padding-left:18px}
@media(max-width:800px){.filelist{columns:1}}
.where{margin-top:12px;font-size:12.5px;color:var(--muted);border-top:1px dashed var(--border);padding-top:10px}

table{width:100%;border-collapse:collapse;font-size:14px;margin:12px 0}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);background:var(--surface-2)}
.md-table{border:1px solid var(--border);border-radius:8px;overflow:hidden}
.stepno{font-family:var(--serif);font-weight:700;color:var(--accent);width:34px}

details.file,details.qa{background:var(--surface);border:1px solid var(--border);border-radius:9px;
  margin-bottom:9px;overflow:hidden;scroll-margin-top:80px}
details.file>summary,details.qa>summary{cursor:pointer;padding:11px 15px;display:flex;gap:10px;
  align-items:center;flex-wrap:wrap;list-style:none;font-weight:600}
details>summary::-webkit-details-marker{display:none}
details.file>summary:hover,details.qa>summary:hover{background:var(--surface-2)}
details[open]>summary{border-bottom:1px solid var(--border);background:var(--surface-2)}
.fpath{font-family:var(--mono);font-size:12.5px;flex:1;min-width:170px;word-break:break-all}
.fmeta{display:flex;gap:5px;flex-wrap:wrap}
.filenote,details.file>pre,details.qa>.bi{padding:0 15px 15px}
.filenote.shared{background:var(--surface-2)}
.sharedhead{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;font-weight:800;color:var(--accent);margin-bottom:8px}
.filenote{padding-top:13px;border-bottom:1px dashed var(--border);margin-bottom:2px}
details.qa>.bi{padding-top:12px}
.qmark{width:20px;height:20px;border-radius:5px;background:var(--accent);color:#FFFDF9;display:inline-flex;
  align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none;font-family:var(--sans)}
.grouphead{font-size:15px;margin:26px 0 10px;color:var(--accent);text-transform:uppercase;
  letter-spacing:.07em;font-family:var(--sans);font-weight:800}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:13px 15px}
.stat b{display:block;font-family:var(--serif);font-size:24px;font-weight:700}
.stat span{font-size:12px;color:var(--muted)}

.callout{border-left:3px solid var(--accent);background:var(--surface-2);padding:12px 16px;
  border-radius:0 8px 8px 0;margin:14px 0}
.callout strong{color:var(--accent)}

/* language toggle */
body[data-lang="en"] .lang-bn{display:none}
body[data-lang="bn"] .lang-en{display:none}
body[data-lang="both"] .lang-bn{border-top:1px dashed var(--border-2);margin-top:10px;padding-top:10px}
body[data-lang="both"] .lang-bn::before{content:'বাংলা';display:block;font-size:10px;font-weight:800;
  letter-spacing:.1em;color:var(--muted);margin-bottom:4px}
.lang-bn{font-family:var(--sans)}
.hidden{display:none !important}

@media(max-width:900px){
  .side{display:none}
  main{padding:20px 16px 70px}
}
@media print{
  .side,.toolbar{display:none}
  details{page-break-inside:avoid}
  details:not([open])>*:not(summary){display:revert}
  details>*{display:revert !important}
}
</style>

<div class="layout">
<nav class="side">
  <h1>RentalFlow</h1>
  <div class="tag">Viva Guide · CSE470</div>
  <div class="navgroup">Start here</div>
  <a href="#overview">Overview &amp; how to run</a>
  <a href="#process">SE model &amp; methodology</a>
  <a href="#arch">Software architecture</a>
  <a href="#mvc">MVC — the full answer</a>
  <a href="#patterns">Design patterns</a>
  <a href="#lifecycle">Request lifecycle</a>
  <div class="navgroup">The team</div>
  ${members.map((m) => `<a href="#member-${m.id}">${m.id} · ${esc(m.nick)} — ${esc(m.area)}</a>`).join('')}
  <div class="navgroup">Features</div>
  <a href="#features">All 20 features (F1–F20)</a>
  <a href="#shared">Co-authored files</a>
  <div class="navgroup">Source code</div>
  ${readingOrder.map((g) => `<a href="#code">${esc(g.group)}</a>`).join('')}
  <div class="navgroup">Practice</div>
  <a href="#qa">Question bank</a>
</nav>

<main>
  <div class="toolbar">
    <input id="q" placeholder="Search files, features, questions…" autocomplete="off">
    <button class="btn" data-lang="en">English</button>
    <button class="btn" data-lang="bn">বাংলা</button>
    <button class="btn on" data-lang="both">Both</button>
    <button class="btn" id="expand">Expand all</button>
  </div>

  <section class="block" id="overview">
    <h2>${esc(meta.project)} — ${esc(meta.subtitle)}</h2>
    <p class="dim">${esc(meta.course)} · ${esc(meta.university)}</p>
    <div class="stats">
      <div class="stat"><b>4</b><span>team members</span></div>
      <div class="stat"><b>20</b><span>features (5 each)</span></div>
      <div class="stat"><b>4</b><span>sprints</span></div>
      <div class="stat"><b>${fileCount}</b><span>source files</span></div>
      <div class="stat"><b>${lineCount.toLocaleString('en-US')}</b><span>lines of code</span></div>
      <div class="stat"><b>35</b><span>unit tests passing</span></div>
    </div>
    <p><strong>Stack:</strong> ${esc(meta.stack)}</p>
    <div class="callout">
      <strong>The one-sentence pitch.</strong>
      RentalFlow is a peer-to-peer marketplace where members list their own equipment for rent and rent
      from each other, with tracked availability, refundable deposits, QR check-out, photo condition
      reports, automatic late fees and damage penalties, and an admin console over the top.
      <div class="lang-bn" style="margin-top:8px">
        RentalFlow একটি peer-to-peer মার্কেটপ্লেস যেখানে সদস্যরা নিজেদের যন্ত্রপাতি ভাড়ায় দেয় ও একে অপরের
        কাছ থেকে ভাড়া নেয় — প্রাপ্যতা ট্র্যাকিং, ফেরতযোগ্য ডিপোজিট, QR চেক-আউট, ছবি সহ অবস্থার রিপোর্ট,
        স্বয়ংক্রিয় লেট ফি ও ক্ষতিপূরণ, এবং সবার উপরে একটি অ্যাডমিন কনসোল সহ।
      </div>
    </div>
    <h3 class="grouphead">Run it in front of the examiner</h3>
    <pre><code class="language-bash">docker compose up -d          # PostgreSQL
cd server &amp;&amp; npm install &amp;&amp; npm run db:init &amp;&amp; npm run db:seed &amp;&amp; npm run db:seed4
npm start                     # API  → http://localhost:4000
cd ../client &amp;&amp; npm install &amp;&amp; npm run dev    # App → http://localhost:5173
cd ../server &amp;&amp; npm test      # 35 unit tests</code></pre>
    <table>
      <tr><th>Role</th><th>Email</th><th>Password</th></tr>
      <tr><td>Member</td><td>rahim@rentalflow.test</td><td>member123</td></tr>
      <tr><td>Member</td><td>karim@rentalflow.test</td><td>member123</td></tr>
      <tr><td>Admin</td><td>admin@rentalflow.test</td><td>admin123</td></tr>
      <tr><td>Staff</td><td>staff@rentalflow.test</td><td>staff123</td></tr>
    </table>
  </section>

  <section class="block" id="process">
    <h2>Software engineering model &amp; methodology</h2>
    <div class="callout"><strong>One-line answer:</strong> ${esc(seModel.modelName)}.</div>
    <div class="card">${bi(seModel.answerEn, seModel.answerBn)}</div>
  </section>

  <section class="block" id="arch">
    <h2>Software architecture</h2>
    <div class="callout">
      <div class="lang-en"><strong>One-line answer:</strong> ${esc(architecture.headlineEn)}</div>
      <div class="lang-bn"><strong>এক লাইনে:</strong> ${esc(architecture.headlineBn)}</div>
    </div>
    <div class="card">
      <pre><code class="language-plaintext">┌─────────────────────────────────────────────────────────────┐
│  TIER 1 · PRESENTATION          client/  (React SPA)        │
│  pages/*.jsx · components · App.jsx (routing + guards)      │
│  auth.jsx (session Context) · api.js (HTTP facade)          │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTPS / JSON  (REST)
┌───────────────────────────▼─────────────────────────────────┐
│  TIER 2 · APPLICATION           server/  (Express API)      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Middleware   blockSuspended → auditLogger → auth      │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Routes       routes/*.js        (the Controllers)     │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Domain logic *Utils.js   pure, no DB, unit-tested     │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │  db.js — one pool, raw SQL
┌───────────────────────────▼─────────────────────────────────┐
│  TIER 3 · DATA                  PostgreSQL                  │
│  users · items · categories · tags · item_tags · images     │
│  accessories · bookings · condition_reports · repair_jobs   │
│  notifications · audit_logs                                 │
└─────────────────────────────────────────────────────────────┘</code></pre>
      ${bi(architecture.layersEn, architecture.layersBn)}
    </div>
  </section>

  <section class="block" id="mvc">
    <h2>“Are you using MVC?”</h2>
    <div class="card">${bi(architecture.mvcEn, architecture.mvcBn)}</div>
  </section>

  <section class="block" id="patterns">
    <h2>Design patterns used</h2>
    <table><tr><th>Pattern</th><th>Where</th><th>Why</th></tr>${patternsHtml}</table>
  </section>

  <section class="block" id="lifecycle">
    <h2>What happens when a user books an item</h2>
    <p class="dim">Follow this end to end and you can answer almost any “how does it work” question.</p>
    <table><tr><th>#</th><th>Who</th><th>Does what</th></tr>${lifecycleHtml}</table>
  </section>

  <section class="block" id="team">
    <h2>The team — who built what</h2>
    ${membersHtml}
  </section>

  <section class="block" id="shared">
    <h2>Co-authored files — who wrote which part</h2>
    <div class="callout">
      <div class="lang-en"><strong>Read this before the viva.</strong> Most files have one owner, but these
      carry features from more than one member. If the examiner opens one of them and asks
      “who wrote this?”, the honest answer is per <em>function</em>, not per file. Find your own rows.</div>
      <div class="lang-bn"><strong>ভাইভার আগে এটি পড়ুন।</strong> বেশিরভাগ ফাইলের একজন মালিক, কিন্তু এগুলোতে
      একাধিক সদস্যের ফিচার আছে। পরীক্ষক যদি এর কোনোটি খুলে জিজ্ঞেস করেন “এটা কে লিখেছে?”, সৎ উত্তরটি
      ফাইল অনুযায়ী নয়, <em>ফাংশন</em> অনুযায়ী। নিজের সারিগুলো খুঁজে নিন।</div>
    </div>
    ${Object.entries(sharedFiles).map(([rel, s]) => `
    <section class="card" data-search="${esc(rel)}">
      <h3><code>${esc(rel)}</code></h3>
      ${bi(s.en, s.bn)}
      <table class="md-table"><tr><th>Who</th><th>Which part</th><th>Feature</th><th>What it does</th></tr>
      ${s.parts.map((p) => {
        const m = members.find((x) => x.id === p.who);
        return `<tr>
          <td><span class="chip owner-${p.who}">${p.who} · ${esc(m ? m.nick : '')}</span></td>
          <td><code>${esc(p.what)}</code></td>
          <td><span class="chip feat">${esc(p.feat)}</span></td>
          <td>${p.en ? bi(p.en, p.bn) : ''}</td>
        </tr>`;
      }).join('')}
      </table>
    </section>`).join('')}
  </section>

  <section class="block" id="features">
    <h2>All 20 features, with the logic behind them</h2>
    ${featuresHtml}
  </section>

  <section class="block" id="code">
    <h2>The complete source code</h2>
    <p class="dim">Every file, in reading order, tagged with its owner and the features it implements. Click to expand.</p>
    ${codeHtml}
  </section>

  <section class="block" id="qa">
    <h2>Viva question bank</h2>
    <p class="dim">Click a question to reveal the answer in both languages.</p>
    ${qaHtml}
  </section>
</main>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script>
document.body.dataset.lang = 'both';
document.querySelectorAll('.btn[data-lang]').forEach(function (b) {
  b.addEventListener('click', function () {
    document.body.dataset.lang = b.dataset.lang;
    document.querySelectorAll('.btn[data-lang]').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
  });
});

var expanded = false;
document.getElementById('expand').addEventListener('click', function () {
  expanded = !expanded;
  document.querySelectorAll('details').forEach(function (d) { d.open = expanded; });
  this.textContent = expanded ? 'Collapse all' : 'Expand all';
});

// Search: filter files, features and questions by their data-search text.
var q = document.getElementById('q');
q.addEventListener('input', function () {
  var term = q.value.trim().toLowerCase();
  document.querySelectorAll('[data-search]').forEach(function (el) {
    if (!term) { el.classList.remove('hidden'); return; }
    var hay = (el.dataset.search + ' ' + el.textContent).toLowerCase();
    el.classList.toggle('hidden', hay.indexOf(term) === -1);
  });
});

if (window.hljs) {
  document.querySelectorAll('pre code').forEach(function (el) {
    try { hljs.highlightElement(el); } catch (e) {}
  });
}
</script>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
console.log(`  ${fileCount} source files · ${lineCount.toLocaleString('en-US')} lines embedded`);
console.log(`  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
