// Locks each finished quarter's OPSP Critical Numbers into
// _src/gaf-master-dashboard/data/opsp-finals.json, which the dashboard shows in place
// of live recalculation once a quarter is over (see OPSPDashboard.tsx, "finished quarters").
//
// It doesn't re-implement any dashboard logic. It opens the LIVE dashboard in capture
// mode (?view=opsp&quarter=<label>&capture=1), waits until every feed has answered,
// and copies the rows the dashboard itself worked out. It runs against the live site
// because the docs proxy only serves the site's own origin.
//
// Usage (from the repo root):
//   node _pipelines/opsp-finals/capture.mjs --check          list finished quarters with no record
//   node _pipelines/opsp-finals/capture.mjs                   capture all of those
//   node _pipelines/opsp-finals/capture.mjs --quarter "Q2 FY27" [--force]
//                                                             capture one (--force overwrites)
// Run by .github/workflows/opsp-finals.yml the morning after each quarter ends.

import fs from 'node:fs';

const FINALS_PATH = '_src/gaf-master-dashboard/data/opsp-finals.json';
const SITE = process.env.DASHBOARD_URL || 'https://the-afs-group.github.io/gaf-master-dashboard/';
const FIRST_FY = 27;   // the dashboard's first quarter is Q1 FY27
const LAST_FY = 30;
const WAIT_MS = 180_000;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };

// Same quarters as the dashboard: FY starts 1 July, labelled "Q<n> FY<yy>".
const quarters = [];
for (let fy = FIRST_FY; fy <= LAST_FY; fy++) {
    const spans = [[7, 9], [10, 12], [1, 3], [4, 6]];
    spans.forEach(([m1, m2], i) => {
        const y = i < 2 ? 2000 + fy - 1 : 2000 + fy;
        const lastDay = new Date(Date.UTC(y, m2, 0)).getUTCDate();
        const pad = (n) => String(n).padStart(2, '0');
        quarters.push({ label: `Q${i + 1} FY${fy}`, start: `${y}-${pad(m1)}-01`, end: `${y}-${pad(m2)}-${pad(lastDay)}` });
    });
}

const todayAdelaide = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const finals = JSON.parse(fs.readFileSync(FINALS_PATH, 'utf8'));

let targets;
const only = opt('--quarter');
if (only) {
    const q = quarters.find((x) => x.label.toUpperCase() === only.replace(/[-_]/g, ' ').trim().toUpperCase());
    if (!q) { console.error(`Unknown quarter "${only}"`); process.exit(2); }
    if (q.end >= todayAdelaide) { console.error(`${q.label} hasn't finished yet (ends ${q.end})`); process.exit(2); }
    if (finals[q.label] && !flag('--force')) { console.log(`${q.label} already locked; pass --force to overwrite`); targets = []; }
    else targets = [q];
} else {
    targets = quarters.filter((q) => q.end < todayAdelaide && !finals[q.label]);
}

if (flag('--check')) {
    const list = targets.map((q) => q.label).join(',');
    console.log(list ? `To capture: ${list}` : 'Nothing to capture');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `targets=${list}\n`);
    process.exit(0);
}
if (!targets.length) { console.log('Nothing to capture'); process.exit(0); }

const { chromium } = await import('playwright');
const browser = await chromium.launch();
let failed = 0;

for (const q of targets) {
    const url = `${SITE}?view=opsp&quarter=${encodeURIComponent(q.label)}&capture=1`;
    console.log(`\n${q.label}: ${url}`);
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        let snap = null;
        const deadline = Date.now() + WAIT_MS;
        while (Date.now() < deadline) {
            snap = await page.evaluate(() => window.__OPSP_CAPTURE__ || null);
            if (snap && snap.quarter === q.label && snap.ready) break;
            await page.waitForTimeout(3000);
        }
        if (!snap || snap.quarter !== q.label) throw new Error('dashboard never reported a capture (is capture mode deployed?)');
        if (snap.notPublished) { console.log(`  skipped: ${q.label} has no published OPSP doc`); continue; }
        if (!snap.ready) throw new Error(`timed out waiting for: ${snap.pending.join(', ')}`);
        if (!snap.docLive) throw new Error('quarter doc did not load (dashboard fell back to its snapshot)');
        if (!snap.rows.length) throw new Error('no Critical Numbers rows');

        finals[q.label] = {
            asAt: q.end,
            capturedAt: new Date().toISOString(),
            method: 'auto',
            rows: snap.rows,
        };
        for (const r of snap.rows) console.log(`  ${r.name}: ${r.current || '—'} (${r.badge.label}) • ${r.owner}`);
    } catch (e) {
        failed++;
        console.error(`  FAILED: ${e.message}`);
    } finally {
        await page.close();
    }
}
await browser.close();

fs.writeFileSync(FINALS_PATH, JSON.stringify(finals, null, 2) + '\n');
process.exit(failed ? 1 : 0);
