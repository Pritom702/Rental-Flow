// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: safe link previews (title, picture, site)
// ============================================================
// When someone shares a link, the SERVER fetches the page once and keeps its
// title / description / picture, so readers' browsers never load the site
// just to draw a card. Guarded so it cannot be abused:
//   • only http(s) links to real hostnames (checkLinkUrl)
//   • every hop's address is resolved first and private / loopback / cloud
//     metadata addresses are refused (no server-side request forgery)
//   • redirects are followed by hand (max 3), each one re-checked
//   • 5 second timeout, and at most 400 KB of the page is read
//   • optional Google Safe Browsing check when SAFE_BROWSING_KEY is set
import dns from 'dns/promises';
import { checkLinkUrl, isPrivateAddress, parseMeta, youtubeId } from './socialUtils.js';

const MAX_BYTES = 400 * 1024;
const TIMEOUT_MS = 5000;

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function assertPublicHost(hostname) {
  let addrs;
  try { addrs = await dns.lookup(hostname, { all: true }); } catch { throw fail('That website could not be found.'); }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
    throw fail('That link points to a private network, so it cannot be shared.');
  }
}

async function safeBrowsing(url) {
  const key = process.env.SAFE_BROWSING_KEY;
  if (!key) return;
  try {
    const r = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        client: { clientId: 'rentalflow', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (data.matches?.length) throw fail('That link is flagged as dangerous (malware or phishing), so it cannot be shared.');
  } catch (e) {
    if (e.status) throw e;   // flagged: refuse. A lookup that failed is not a reason to block.
  }
}

async function readLimited(res) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

// → { url, title, description, image, site, youtube }
export async function fetchPreview(raw) {
  const first = checkLinkUrl(raw);
  if (first.error) throw fail(first.error);
  let url = first.url;
  await safeBrowsing(url.href);
  const basic = () => ({ url: url.href, title: null, description: null, image: null, site: url.hostname.replace(/^www\./, ''), youtube: null });

  // YouTube: a fixed, trusted endpoint gives the title; the thumbnail is known.
  const yt = youtubeId(url.href);
  if (yt) {
    let title = null;
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (r.ok) title = (await r.json()).title?.slice(0, 200) || null;
    } catch { /* keep going without a title */ }
    return { ...basic(), title, site: 'YouTube', image: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, youtube: yt };
  }

  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicHost(url.hostname);
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RentalFlowPreview/1.0)', Accept: 'text/html,application/xhtml+xml' },
      });
    } catch {
      return basic();   // slow or unreachable: share the plain link
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      const next = checkLinkUrl(new URL(location, url).href);
      if (next.error) throw fail(next.error);
      url = next.url;
      continue;
    }
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return basic();
    const html = await readLimited(res);
    const meta = parseMeta(html, url.href);
    return { ...basic(), ...meta, site: meta.site || basic().site };
  }
  return basic();
}
