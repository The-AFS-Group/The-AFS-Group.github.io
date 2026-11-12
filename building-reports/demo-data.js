// Made-up jobs, loaded only by manage.html?demo and landlord.html?demo to show how the pages work.
// Nothing here is real. Photos are drawn on the fly. Changes last until the page reloads.
// Safe to delete if you don't want a demo.
window.BR_DEMO = (function () {
  'use strict';
  var NOW = Date.now(), H = 36e5, D = 864e5;
  function pad(n) { return String(n).padStart(2, '0'); }
  function stamp(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00'; }
  function day(ms) { return stamp(ms).slice(0, 10); }

  /* ---------- drawn placeholder photos ---------- */
  function scene(kind, marked) {
    var c = document.createElement('canvas'); c.width = 960; c.height = 720;
    var x = c.getContext('2d'), W = c.width, Hh = c.height, i;
    function rect(col, a, b, w, h) { x.fillStyle = col; x.fillRect(a, b, w, h); }
    if (kind === 'ceiling') {
      rect('#E9E6DF', 0, 0, W, Hh);
      x.strokeStyle = '#C9C4B9'; x.lineWidth = 6;
      for (i = 0; i <= W; i += 160) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, Hh); x.stroke(); }
      for (i = 0; i <= Hh; i += 160) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
      var g = x.createRadialGradient(470, 330, 10, 470, 330, 190);
      g.addColorStop(0, 'rgba(120,84,40,.85)'); g.addColorStop(.6, 'rgba(150,110,60,.45)'); g.addColorStop(1, 'rgba(150,110,60,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(470, 330, 230, 170, .2, 0, 7); x.fill();
      rect('rgba(110,80,40,.7)', 468, 470, 6, 90);
    } else if (kind === 'door') {
      rect('#9AA3AB', 0, 0, W, Hh); rect('#6E767D', 0, 600, W, 120);
      for (i = 80; i < 600; i += 34) { rect('#C3C9CE', 150, i, 660, 26); rect('#A7AEB4', 150, i + 26, 660, 8); }
      x.fillStyle = 'rgba(40,44,48,.55)'; x.beginPath(); x.ellipse(560, 420, 70, 40, -.3, 0, 7); x.fill();
      rect('#2B2F33', 150, 560, 660, 40);
    } else if (kind === 'floor') {
      rect('#D8D2C6', 0, 0, W, Hh);
      x.strokeStyle = '#B9B2A4'; x.lineWidth = 5;
      for (i = 0; i <= W; i += 240) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, Hh); x.stroke(); }
      for (i = 0; i <= Hh; i += 240) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
      x.strokeStyle = '#4A4540'; x.lineWidth = 5; x.beginPath(); x.moveTo(250, 260);
      [[310, 300], [345, 290], [400, 350], [430, 345], [470, 400], [520, 410], [560, 470]].forEach(function (p) { x.lineTo(p[0], p[1]); }); x.stroke();
    } else if (kind === 'floor-new') {
      rect('#E4DED2', 0, 0, W, Hh);
      x.strokeStyle = '#C9C1B1'; x.lineWidth = 5;
      for (i = 0; i <= W; i += 240) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, Hh); x.stroke(); }
      for (i = 0; i <= Hh; i += 240) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
      rect('rgba(255,255,255,.35)', 240, 240, 240, 240);
    } else if (kind === 'light') {
      rect('#3B4148', 0, 0, W, Hh);
      rect('#5A626B', 260, 260, 440, 120); rect('#2A2F35', 280, 280, 400, 80);
      rect('#E8EDF2', 520, 280, 160, 80);
    } else if (kind === 'aircon') {
      rect('#EEEAE2', 0, 0, W, Hh); rect('#FFFFFF', 220, 120, 520, 170); rect('#DAD5CB', 240, 250, 480, 22);
      x.fillStyle = 'rgba(70,120,170,.55)'; [[400, 330], [470, 380], [430, 450], [520, 520]].forEach(function (p) { x.beginPath(); x.ellipse(p[0], p[1], 9, 14, 0, 0, 7); x.fill(); });
      x.fillStyle = 'rgba(70,120,170,.25)'; x.beginPath(); x.ellipse(470, 640, 200, 40, 0, 0, 7); x.fill();
    } else if (kind === 'wall') {
      rect('#F2EFE8', 0, 0, W, Hh); rect('#CFC8BA', 0, 560, W, 160);
      rect('#FFFFFF', 330, 300, 90, 130); rect('#FFFFFF', 520, 300, 90, 130);
      x.strokeStyle = '#9C9588'; x.lineWidth = 4; x.strokeRect(330, 300, 90, 130); x.strokeRect(520, 300, 90, 130);
    } else {
      rect('#0E2A44', 0, 0, W, Hh); x.save(); x.translate(480, 330); x.rotate(-.07); rect('#FFFFFF', -300, -90, 600, 180); x.restore();
      x.fillStyle = 'rgba(14,42,68,.35)'; x.beginPath(); x.moveTo(600, 300); x.lineTo(780, 260); x.lineTo(760, 420); x.closePath(); x.fill();
    }
    if (marked) {
      x.lineCap = 'round'; x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 16;
      x.beginPath(); x.ellipse(marked[0], marked[1], 170, 120, 0, 0, 7); x.stroke();
      x.strokeStyle = '#F26422'; x.lineWidth = 10; x.beginPath(); x.ellipse(marked[0], marked[1], 170, 120, 0, 0, 7); x.stroke();
    }
    x.fillStyle = 'rgba(14,42,68,.82)'; x.fillRect(16, 16, 170, 40);
    x.fillStyle = '#fff'; x.font = '700 20px Archivo, Tahoma, sans-serif'; x.textBaseline = 'middle'; x.fillText('DEMO PHOTO', 30, 37);
    return { full: BR.b64(c.toDataURL('image/jpeg', .82)), thumb: BR.b64(BR.thumbOf(c)) };
  }

  /* ---------- jobs ---------- */
  var landlords = [
    { name: 'Demo Property Group', pin: 'demo-landlord', sites: ['Molendinar Warehouse'], hasEmail: true },
    { name: 'Demo Holdings', pin: 'demo-2', sites: ['Arundel EC'], hasEmail: false }
  ];
  var jobs = [], photos = [], activity = [], seq = 0;
  function job(o) {
    seq++;
    var j = Object.assign({
      id: 'demo-' + seq, ref: 'BR-' + pad(0) + pad(seq), status: 'New', priority: 'Normal', area: '', trade: '', description: '',
      reporterName: 'Demo Staff', reporterContact: '', voiceUsed: false, photosExpected: 0, responsibility: 'TBC', sharedWithLandlord: false,
      tradeCompany: '', tradeContact: '', scheduledFor: '', quote: null, finalCost: null, invoiceRef: '', paid: false,
      completedAt: '', completionNotes: '', updatedBy: 'Demo Staff'
    }, o);
    j.submittedAt = stamp(NOW - o.ago);
    j.updatedAt = stamp(NOW - (o.updatedAgo != null ? o.updatedAgo : o.ago));
    jobs.push(j);
    log(j, j.ago, j.reporterName, 'reporter', 'created', 'Reported: ' + j.title, false);
    return j;
  }
  function photo(j, kind, sceneKind, caption, marked, ago) {
    var s = scene(sceneKind, marked);
    photos.push({ id: 'ph-' + photos.length, jobId: j.id, kind: kind, caption: caption, annotated: !!marked,
      uploadedAt: stamp(NOW - (ago != null ? ago : j.ago)), uploadedBy: kind === 'report' ? 'Reporter' : 'Demo Manager', thumb: s.thumb, full: s.full });
    if (kind === 'report') j.photosExpected++;
  }
  function log(j, ago, who, role, type, detail, vis) {
    activity.push({ jobId: j.id, at: stamp(NOW - ago), who: who, role: role, type: type, detail: detail, landlordCanSee: !!vis });
  }

  var j;
  j = job({ ago: 2 * H, priority: 'Urgent', site: 'Arundel EC', area: 'Ceiling above the front counter', category: 'Damage', trade: 'Plumbing',
    title: 'Water leaking through the ceiling above the front counter', reporterName: 'Demo Staff A', reporterContact: '0400 000 000', voiceUsed: true,
    description: 'Started dripping around 9 this morning after the rain. Ceiling tile is stained and sagging. We have put a bucket down and moved the display bike away from it.' });
  photo(j, 'report', 'ceiling', 'Stain on the ceiling tile, bigger than yesterday', [470, 330]);
  photo(j, 'report', 'ceiling', 'Drip line onto the counter');

  j = job({ ago: 4 * D, updatedAgo: 6 * H, priority: 'High', site: 'Molendinar Warehouse', area: 'Loading dock, roller door 2', category: 'Damage', trade: 'Roller doors & dock',
    title: 'Roller door 2 won’t close fully', reporterName: 'Demo Staff B', status: 'Scheduled', responsibility: 'Landlord', sharedWithLandlord: true,
    tradeCompany: 'Demo Doors Pty Ltd', tradeContact: '02 0000 0000', scheduledFor: day(NOW + 2 * D), quote: 1450,
    description: 'Forklift clipped the bottom rail. Door stops about 30cm from the ground so the dock can’t be locked overnight.' });
  photo(j, 'report', 'door', 'Dent in the bottom slats', [560, 430]);
  photo(j, 'report', 'door', 'Gap at the bottom when closed');
  log(j, 4 * D - H, 'Demo Manager', 'manager', 'status', 'Status: New → Acknowledged', true);
  log(j, 3 * D, 'Demo Manager', 'manager', 'field', 'Who pays: TBC → Landlord', false);
  log(j, 3 * D, 'Demo Manager', 'manager', 'shared', 'Shared with the landlord', true);
  log(j, 3 * D - H, 'Demo Manager', 'manager', 'message', 'Hi, the dock door was damaged and can’t be secured. Under the lease this sits with you. Can you approve the attached quote of $1,450 + GST?', true);
  log(j, 2 * D, 'Demo Landlord (Demo Property Group)', 'landlord', 'landlord_comment', 'Approved. Please go ahead with Demo Doors and send the invoice to our accounts team.', true);
  log(j, 6 * H, 'Demo Manager', 'manager', 'status', 'Status: Awaiting approval → Scheduled', true);

  j = job({ ago: 26 * H, site: 'Arundel EC', area: 'Back office', category: 'Maintenance', trade: 'Electrical', status: 'Acknowledged', responsibility: 'AFS',
    title: 'Two fluorescent tubes out in the back office', reporterName: 'Demo Staff C' });
  photo(j, 'report', 'light', '', null);
  log(j, 20 * H, 'Demo Manager', 'manager', 'status', 'Status: New → Acknowledged', true);

  j = job({ ago: 6 * D, site: 'Arundel EC', area: 'Staff kitchen', category: 'Building requirement', trade: 'Carpentry & joinery', status: 'Quoting', responsibility: 'AFS',
    title: 'Lockable cabinet for first aid supplies', reporterName: 'Demo Staff D', description: 'First aid kit is on an open shelf. Need a wall cabinet that locks, near the kitchen.' });
  log(j, 5 * D, 'Demo Manager', 'manager', 'note', 'Asked two joiners for quotes. Expect them by Friday.', false);

  j = job({ ago: 18 * D, updatedAgo: 9 * D, priority: 'Low', site: 'Molendinar Warehouse', area: 'Staff car park', category: 'Maintenance', trade: 'Landscaping & car park',
    title: 'Car park line marking has faded', reporterName: 'Demo Staff E', status: 'On hold' });
  photo(j, 'report', 'floor', 'Bays 1 to 6', null);
  log(j, 9 * D, 'Demo Manager', 'manager', 'note', 'Holding until the landlord’s resurfacing works in March.', false);

  j = job({ ago: 12 * D, updatedAgo: 5 * D, priority: 'High', site: 'Molendinar Warehouse', area: 'Office entrance', category: 'Damage', trade: 'Flooring',
    title: 'Cracked floor tile at the entrance: trip hazard', reporterName: 'Demo Staff A', status: 'Completed', responsibility: 'Landlord', sharedWithLandlord: true,
    tradeCompany: 'Demo Tiling', quote: 680, finalCost: 680, invoiceRef: 'INV-2210', completedAt: day(NOW - 5 * D),
    completionNotes: 'Replaced two tiles and regrouted the entrance threshold. Spare tiles left in the store room.' });
  photo(j, 'report', 'floor', 'Crack runs across two tiles', [400, 350]);
  photo(j, 'completion', 'floor-new', 'New tiles laid and grouted', null, 5 * D);
  log(j, 11 * D, 'Demo Manager', 'manager', 'shared', 'Shared with the landlord', true);
  log(j, 5 * D, 'Demo Manager', 'manager', 'status', 'Status: Scheduled → Completed', true);

  j = job({ ago: 30 * D, updatedAgo: 20 * D, site: 'Arundel EC', area: 'Treadmill display', category: 'Maintenance', trade: 'Air-con & HVAC',
    title: 'Air-con dripping onto the display floor', reporterName: 'Demo Staff F', status: 'Completed', responsibility: 'AFS',
    tradeCompany: 'Demo Cooling', finalCost: 420, invoiceRef: 'DC-5531', paid: true, completedAt: day(NOW - 20 * D), completionNotes: 'Cleared a blocked drain line and cleaned the filters.' });
  photo(j, 'report', 'aircon', 'Drips land on the treadmill deck', [470, 420]);
  photo(j, 'completion', 'aircon', 'Unit serviced, no more drips', null, 20 * D);

  j = job({ ago: 9 * D, updatedAgo: D, site: 'Molendinar Warehouse', area: 'Packing bench 3', category: 'Building requirement', trade: 'Electrical',
    title: 'Extra power points at the packing bench', reporterName: 'Demo Staff B', status: 'In progress', responsibility: 'Shared', sharedWithLandlord: true,
    tradeCompany: 'Demo Electrical', quote: 950, scheduledFor: day(NOW - D) });
  photo(j, 'report', 'wall', 'Only two outlets for four label printers', [470, 365]);
  log(j, 8 * D, 'Demo Manager', 'manager', 'shared', 'Shared with the landlord', true);
  log(j, D, 'Demo Manager', 'manager', 'status', 'Status: Scheduled → In progress', true);

  j = job({ ago: 8 * D, updatedAgo: 2 * D, priority: 'Low', site: 'Arundel EC', area: 'Front window', category: 'Maintenance', trade: 'Signage',
    title: 'Front window signage peeling', reporterName: 'Demo Staff G', status: 'Completed', responsibility: 'AFS', tradeCompany: 'Demo Signs', completedAt: day(NOW - 2 * D) });
  photo(j, 'report', 'sign', 'Top corner lifting', null);

  // Number the refs in the order the reports came in, oldest first.
  jobs.slice().sort(function (a, b) { return a.submittedAt.localeCompare(b.submittedAt); }).forEach(function (x, i) { x.ref = 'BR-' + String(i + 1).padStart(4, '0'); });

  /* ---------- request handling, mirroring the Apps Script ---------- */
  function wait(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 250); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function find(id) { return jobs.filter(function (x) { return x.id === id; })[0]; }
  function landlordFor(pin) { return landlords.filter(function (l) { return l.pin === pin; })[0]; }
  function covers(l, site) { return l.sites.some(function (s) { return s === '*' || s === site; }); }
  function counts(j) {
    var r = photos.filter(function (p) { return p.jobId === j.id; });
    return { report: r.filter(function (p) { return p.kind === 'report'; }).length, completion: r.filter(function (p) { return p.kind === 'completion'; }).length };
  }
  function withThumbs(j) {
    var o = clone(j), rp = photos.filter(function (p) { return p.jobId === j.id && p.kind === 'report'; })[0], cp = photos.filter(function (p) { return p.jobId === j.id && p.kind === 'completion'; })[0];
    o.photos = counts(j); if (rp) o.thumb = rp.thumb; if (cp) o.completionThumb = cp.thumb;
    return o;
  }
  function forLandlord(j) {
    var pays = BR.LANDLORD_PAYS.indexOf(j.responsibility) >= 0;
    var o = withThumbs(j);
    ['reporterName', 'reporterContact', 'tradeContact', 'updatedBy', 'voiceUsed', 'photosExpected', 'paid'].forEach(function (k) { delete o[k]; });
    o.landlordPays = pays;
    if (!pays) { o.quote = null; o.finalCost = null; o.invoiceRef = ''; }
    return o;
  }
  function detail(id, ll) {
    var j = find(id);
    if (!j || (ll && !(j.sharedWithLandlord && covers(ll, j.site)))) return { ok: false, error: 'not_found' };
    var ph = photos.filter(function (p) { return p.jobId === id; }).map(function (p) {
      var o = { id: p.id, kind: p.kind, caption: p.caption, annotated: p.annotated, uploadedAt: p.uploadedAt, thumb: p.thumb };
      if (!ll) o.uploadedBy = p.uploadedBy;
      return o;
    });
    var act = activity.filter(function (a) { return a.jobId === id && (!ll || a.landlordCanSee); }).sort(function (a, b) { return a.at.localeCompare(b.at); }).map(clone);
    return { ok: true, job: ll ? forLandlord(j) : withThumbs(j), photos: ph, activity: act };
  }
  var LABEL = { status: 'Status', priority: 'Priority', site: 'Site', area: 'Where on site', category: 'Type', trade: 'Trade', title: 'Summary', responsibility: 'Who pays',
    tradeCompany: 'Trade', tradeContact: 'Trade contact', scheduledFor: 'Scheduled for', quote: 'Quote', finalCost: 'Final cost', invoiceRef: 'Invoice ref', paid: 'Paid', completedAt: 'Completed on' };
  function show(k, v) {
    if (k === 'quote' || k === 'finalCost') return v == null ? 'blank' : BR.money(v);
    if (k === 'paid') return v ? 'yes' : 'no';
    return v === '' || v == null ? 'blank' : String(v);
  }

  function get(p) {
    var ll = landlordFor(p.pin);
    if (p.action === 'list') {
      return wait({ ok: true, role: 'manager', jobs: jobs.slice().reverse().map(withThumbs), sheetUrl: '', photosUrl: '',
        landlords: landlords.map(function (l) { return { name: l.name, sites: l.sites, hasEmail: l.hasEmail }; }) });
    }
    if (p.action === 'landlord') {
      ll = ll || landlords[0];
      return wait({ ok: true, role: 'landlord', landlord: { name: ll.name, sites: ll.sites },
        jobs: jobs.filter(function (j) { return j.sharedWithLandlord && covers(ll, j.site); }).reverse().map(forLandlord) });
    }
    if (p.action === 'job') return wait(detail(p.id, ll));
    if (p.action === 'photo') {
      var ph = photos.filter(function (x) { return x.id === p.id; })[0];
      return wait(ph ? { ok: true, id: ph.id, mime: 'image/jpeg', data: ph.full || ph.thumb, url: '' } : { ok: false, error: 'not_found' });
    }
    return wait({ ok: false, error: 'unknown_action' });
  }

  function post(b) {
    var j = find(b.id || (b.photo && b.photo.jobId)), who = b.by || 'Demo Manager';
    if (!j) return wait({ ok: false, error: 'not_found' });
    if (b.action === 'update') {
      var ch = b.changes || {}, out = {};
      Object.keys(ch).forEach(function (k) {
        var v = ch[k];
        if (k === 'quote' || k === 'finalCost') v = String(v).trim() === '' ? null : Math.round(Number(String(v).replace(/[$,\s]/g, '')) * 100) / 100;
        if (v !== j[k]) out[k] = v;
      });
      if (out.status === 'Completed' && !('completedAt' in out) && !j.completedAt) out.completedAt = BR.todayISO();
      if (out.status && BR.CLOSED.indexOf(out.status) < 0 && j.completedAt && !('completedAt' in out)) out.completedAt = '';
      Object.keys(out).forEach(function (k) {
        if (k === 'sharedWithLandlord') log(j, 0, who, 'manager', 'shared', out[k] ? 'Shared with the landlord' : 'No longer shared with the landlord', out[k]);
        else if (k === 'completionNotes') log(j, 0, who, 'manager', 'field', 'Completion notes updated', false);
        else log(j, 0, who, 'manager', k === 'status' ? 'status' : 'field', (LABEL[k] || k) + ': ' + show(k, j[k]) + ' → ' + show(k, out[k]), ['status', 'scheduledFor', 'completedAt'].indexOf(k) >= 0);
        j[k] = out[k];
      });
      j.updatedAt = stamp(Date.now()); j.updatedBy = who;
      return wait(detail(j.id));
    }
    if (b.action === 'note') {
      if (b.landlord && !j.sharedWithLandlord) return wait({ ok: false, error: 'not_shared' });
      log(j, 0, who, 'manager', b.landlord ? 'message' : 'note', b.text, !!b.landlord);
      return wait(detail(j.id));
    }
    if (b.action === 'photo') {
      var p = b.photo;
      photos.push({ id: p.id, jobId: j.id, kind: p.kind, caption: p.caption, annotated: p.annotated, uploadedAt: stamp(Date.now()), uploadedBy: who, thumb: p.thumb, full: p.data });
      if (p.kind === 'completion') log(j, 0, who, 'manager', 'photo', 'Completion photo added' + (p.caption ? ': ' + p.caption : ''), true);
      return wait({ ok: true });
    }
    if (b.action === 'email_landlord') {
      if (!j.sharedWithLandlord) return wait({ ok: false, error: 'not_shared' });
      var to = landlords.filter(function (l) { return l.hasEmail && covers(l, j.site); });
      if (!to.length) return wait({ ok: false, error: 'no_landlord_email' });
      log(j, 0, who, 'manager', 'email', 'Emailed ' + to.map(function (l) { return l.name; }).join(', ') + (b.message ? ': ' + b.message : '') + ' (demo: nothing was sent)', false);
      return wait({ ok: true, sent: to.map(function (l) { return l.name + ' (demo, not sent)'; }) });
    }
    if (b.action === 'landlord_comment') {
      var ll = landlordFor(b.pin) || landlords[0];
      log(j, 0, (b.name ? b.name + ' (' + ll.name + ')' : ll.name), 'landlord', 'landlord_comment', b.text, true);
      return wait(detail(j.id, ll));
    }
    return wait({ ok: false, error: 'unknown_action' });
  }

  return { get: get, post: post };
})();
