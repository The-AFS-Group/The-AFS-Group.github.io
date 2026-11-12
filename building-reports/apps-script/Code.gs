/**
 * AFS Building Reports: Google Sheets + Drive backend.
 *
 * Bound to the "AFS Building Reports" spreadsheet (Extensions > Apps Script).
 * Script Properties (Project Settings > Script properties):
 *   SUBMIT_TOKEN     random string; same value as TOKEN in building-reports/config.js.
 *                    Lets the report form add reports and their photos, and check the status of
 *                    reports it sent. It can't read anything else.
 *   MANAGER_PIN      PIN for manage.html: every job, status, trades, costs, completion photos.
 *   NOTIFY_EMAIL     optional. Comma-separated addresses emailed when a report comes in
 *                    and when a landlord adds a comment.
 *   SITE_URL         optional. Where the pages live, for links in emails.
 *                    Defaults to https://the-afs-group.github.io/building-reports/
 *   REF_PREFIX       optional. Job reference prefix. Defaults to BR (BR-0001, BR-0002...).
 *   PHOTO_FOLDER_ID  set by setup(). The Drive folder that holds every photo.
 *
 * Landlord PINs are rows in the Landlords tab, so landlords can be added without touching code.
 *
 * Tabs:
 *   Jobs       one row per report. The manager page edits status, trade, costs and completion here.
 *   Photos     one row per photo, linking to the file in Drive, with a small preview image.
 *   Activity   every job's history: status changes, notes, messages to and from landlords.
 *   Landlords  landlord name, PIN, the sites they cover, and an email for notifications.
 *
 * Columns are found by their header name, so you can add your own columns or reorder them.
 * Don't rename the existing headers.
 */

var TZ = 'Australia/Sydney';
var DEFAULT_SITE_URL = 'https://the-afs-group.github.io/building-reports/';
var JOBS = 'Jobs', PHOTOS = 'Photos', ACTIVITY = 'Activity', LANDLORDS = 'Landlords';

var STATUSES = ['New', 'Acknowledged', 'Quoting', 'Awaiting approval', 'Scheduled', 'In progress', 'On hold', 'Completed', 'Cancelled'];
var CLOSED = ['Completed', 'Cancelled'];
var RESPONSIBILITY = ['TBC', 'AFS', 'Landlord', 'Shared', 'Insurance', 'Warranty'];
var LANDLORD_PAYS = ['Landlord', 'Shared'];

// [sheet header, JSON key, type]
var JOB_FIELDS = [
  ['ref', 'ref', 'text'],
  ['job_id', 'id', 'text'],
  ['submitted_at', 'submittedAt', 'datetime'],
  ['status', 'status', 'text'],
  ['priority', 'priority', 'text'],
  ['site', 'site', 'text'],
  ['area', 'area', 'text'],
  ['category', 'category', 'text'],
  ['trade', 'trade', 'text'],
  ['title', 'title', 'text'],
  ['description', 'description', 'text'],
  ['reporter_name', 'reporterName', 'text'],
  ['reporter_contact', 'reporterContact', 'text'],
  ['voice_used', 'voiceUsed', 'bool'],
  ['photos_expected', 'photosExpected', 'int'],
  ['report_photos', 'reportPhotos', 'int'],
  ['responsibility', 'responsibility', 'text'],
  ['shared_with_landlord', 'sharedWithLandlord', 'bool'],
  ['trade_company', 'tradeCompany', 'text'],
  ['trade_contact', 'tradeContact', 'text'],
  ['scheduled_for', 'scheduledFor', 'date'],
  ['quote_ex_gst', 'quote', 'money'],
  ['final_cost_ex_gst', 'finalCost', 'money'],
  ['invoice_ref', 'invoiceRef', 'text'],
  ['paid', 'paid', 'bool'],
  ['completed_at', 'completedAt', 'date'],
  ['completion_notes', 'completionNotes', 'text'],
  ['completion_photos', 'completionPhotos', 'int'],
  ['photo_folder', 'photoFolder', 'text'],
  ['updated_at', 'updatedAt', 'datetime'],
  ['updated_by', 'updatedBy', 'text'],
  ['client_time', 'clientTime', 'text']
];
var PHOTO_HEADERS = ['uploaded_at', 'photo_id', 'job_id', 'ref', 'kind', 'caption', 'annotated', 'uploaded_by', 'file_id', 'url', 'thumb'];
var ACTIVITY_HEADERS = ['at', 'job_id', 'ref', 'who', 'role', 'type', 'detail', 'landlord_can_see'];
var LANDLORD_HEADERS = ['landlord', 'pin', 'sites', 'email', 'notes'];
// The column that is always filled on a real row, per tab. New rows go after the last one.
var KEYS = { Jobs: 'job_id', Photos: 'photo_id', Activity: 'at', Landlords: 'landlord' };
var CHECKBOX_COLUMNS = { Jobs: ['voice_used', 'shared_with_landlord', 'paid'] };

// What the manager page may change, and how each value is checked.
var EDITABLE = {
  status: { type: 'enum', values: STATUSES, label: 'Status' },
  priority: { type: 'text', max: 40, label: 'Priority' },
  site: { type: 'text', max: 80, label: 'Site' },
  area: { type: 'text', max: 160, label: 'Where on site' },
  category: { type: 'text', max: 60, label: 'Type' },
  trade: { type: 'text', max: 60, label: 'Trade' },
  title: { type: 'text', max: 160, label: 'Summary' },
  responsibility: { type: 'enum', values: RESPONSIBILITY, label: 'Who pays' },
  sharedWithLandlord: { type: 'bool', label: 'Shared with landlord' },
  tradeCompany: { type: 'text', max: 120, label: 'Trade' },
  tradeContact: { type: 'text', max: 160, label: 'Trade contact' },
  scheduledFor: { type: 'date', label: 'Scheduled for' },
  quote: { type: 'money', label: 'Quote' },
  finalCost: { type: 'money', label: 'Final cost' },
  invoiceRef: { type: 'text', max: 80, label: 'Invoice ref' },
  paid: { type: 'bool', label: 'Paid' },
  completedAt: { type: 'date', label: 'Completed on' },
  completionNotes: { type: 'text', max: 6000, label: 'Completion notes' }
};
// Field changes the landlord sees in the job history (status, dates, sharing).
var LANDLORD_VISIBLE_FIELDS = ['status', 'scheduledFor', 'completedAt'];

var LIMITS = { id: 80, name: 80, contact: 120, site: 80, area: 160, category: 60, trade: 60, priority: 40, title: 160, text: 6000, caption: 200, note: 4000 };
var MAX_PHOTO_CHARS = 14000000;  // ~10 MB image as base64
var MAX_THUMB_CHARS = 48000;     // keeps the preview inside one Sheet cell (50,000 limit)
var LIST_THUMB_DAYS = 120;       // list view sends previews only for open or recent jobs

/* ================= setup ================= */

/**
 * Run once from the editor after pasting the script. Safe to re-run: it only adds what's missing,
 * and moves any jobs that were written below empty rows (by older versions of this script) back up.
 */
function setup() {
  var ss = ss_();
  ss.setSpreadsheetTimeZone(TZ);

  var j = ensureSheet_(ss, JOBS, JOB_FIELDS.map(function (f) { return f[0]; }));
  tidy_(j, 'job_id');
  if (j.getMaxRows() < 1000) {
    j.insertRowsAfter(j.getMaxRows(), 1000 - j.getMaxRows());
    tidy_(j, 'job_id'); // new rows can copy tick boxes from the row above; clear them
  }
  var t = table_(JOBS), rows = j.getMaxRows() - 1;
  function col(h) { return j.getRange(2, t.idx[h] + 1, rows, 1); }
  ['submitted_at', 'updated_at'].forEach(function (h) { col(h).setNumberFormat('yyyy-mm-dd hh:mm'); });
  ['scheduled_for', 'completed_at'].forEach(function (h) { col(h).setNumberFormat('d mmm yyyy'); });
  ['quote_ex_gst', 'final_cost_ex_gst'].forEach(function (h) { col(h).setNumberFormat('$#,##0.00'); });
  col('status').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(true).build());
  col('responsibility').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(RESPONSIBILITY, true).setAllowInvalid(true).build());
  // Tick boxes go on each job's row as it's written. Pre-filling a whole column with them makes
  // Sheets count those rows as used, so new jobs would land below them.
  var used = nextRow_(t) - 2;
  for (var r = 0; r < used; r++) checkboxes_(t, r + 2);
  j.setColumnWidth(t.idx.title + 1, 260);
  j.setColumnWidth(t.idx.description + 1, 360);
  j.setColumnWidth(t.idx.completion_notes + 1, 300);
  col('description').setWrap(true).setVerticalAlignment('top');
  j.setFrozenColumns(1);

  var p = ensureSheet_(ss, PHOTOS, PHOTO_HEADERS);
  tidy_(p, 'photo_id');
  var pt = table_(PHOTOS);
  p.getRange(2, pt.idx.uploaded_at + 1, p.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  p.getRange(2, pt.idx.thumb + 1, p.getMaxRows() - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  p.setColumnWidth(pt.idx.thumb + 1, 80);

  var a = ensureSheet_(ss, ACTIVITY, ACTIVITY_HEADERS);
  tidy_(a, 'at');
  var at = table_(ACTIVITY);
  a.getRange(2, at.idx.at + 1, a.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  a.setColumnWidth(at.idx.detail + 1, 420);

  var l = ensureSheet_(ss, LANDLORDS, LANDLORD_HEADERS);
  var lt = table_(LANDLORDS);
  l.getRange(2, lt.idx.pin + 1, l.getMaxRows() - 1, 1).setNumberFormat('@');
  l.getRange(1, lt.idx.pin + 1).setNote('A PIN for this landlord, 4 to 8 digits. Each landlord needs a different PIN, and none can match MANAGER_PIN.');
  l.getRange(1, lt.idx.sites + 1).setNote('Comma-separated site names, exactly as in config.js. Use * for every site.');
  l.getRange(1, lt.idx.email + 1).setNote('Optional. Used by the "Email landlord" button on the manager page.');

  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  var folder = rootFolder_();
  Logger.log('Photos folder: ' + folder.getUrl());
  if (!prop_('SUBMIT_TOKEN')) Logger.log('Add SUBMIT_TOKEN to Script properties.');
  if (!prop_('MANAGER_PIN')) Logger.log('Add MANAGER_PIN to Script properties.');
  Logger.log(notifyTo_() ? 'New-report emails go to: ' + notifyTo_() : 'NOTIFY_EMAIL is not set, so no new-report emails will be sent.');
}

/**
 * Removes empty rows sitting between the header and real rows, and clears stray tick boxes or
 * values below the last real row. A row is real when its key column has a value.
 */
function tidy_(sh, keyHeader) {
  var t = table_(sh.getName());
  var k = t.idx[keyHeader];
  if (k == null) return;
  function real(i) { return String(t.rows[i][k]).trim() !== ''; }
  var last = -1;
  for (var i = 0; i < t.rows.length; i++) if (real(i)) last = i;
  var below = last + 3, max = sh.getMaxRows();
  if (below <= max) sh.getRange(below, 1, max - below + 1, t.width).clearContent().clearDataValidations();
  for (i = last; i >= 0;) {
    if (real(i)) { i--; continue; }
    var end = i;
    while (i >= 0 && !real(i)) i--;
    sh.deleteRows(i + 3, end - i);
  }
}

/** Editor check: sends a test email to NOTIFY_EMAIL, so you can see straight away whether alerts work. */
function testEmail() {
  var to = notifyTo_();
  if (!to) throw new Error('NOTIFY_EMAIL is not set. Add it under Project Settings > Script properties.');
  MailApp.sendEmail({
    to: to, name: 'AFS Building Reports', subject: 'AFS Building Reports: test email',
    htmlBody: emailHtml_('Test email', 'If you can read this, new-report emails will reach you.', [['Sent to', to]], 'Open the manager page', siteUrl_() + 'manage.html')
  });
  Logger.log('Sent a test email to ' + to + '. Emails left today: ' + MailApp.getRemainingDailyQuota());
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var lastC = sh.getLastColumn();
  var have = lastC ? sh.getRange(1, 1, 1, lastC).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  var missing = headers.filter(function (h) { return have.indexOf(h) < 0; });
  if (missing.length) sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]);
  var width = have.length + missing.length;
  sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#0E2A44').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  return sh;
}

/* ================= web app ================= */

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'bad_json', permanent: true }); }
  body = body || {};
  var handlers = {
    submit: submitAction_,
    photo: photoAction_,
    update: updateAction_,
    note: noteAction_,
    landlord_comment: landlordCommentAction_,
    email_landlord: emailLandlordAction_
  };
  var fn = handlers[body.action];
  if (!fn) return json_({ ok: false, error: 'unknown_action', permanent: true });
  try { return json_(fn(body)); }
  catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'mine') return json_(mineAction_(p));
    if (p.action === 'list') return json_(listAction_(p));
    if (p.action === 'job') return json_(jobAction_(p));
    if (p.action === 'photo') return json_(photoGetAction_(p));
    if (p.action === 'landlord') return json_(landlordListAction_(p));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
  return json_({ ok: true, service: 'afs-building-reports' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ================= auth ================= */

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function tokenOk_(token) {
  var expected = prop_('SUBMIT_TOKEN');
  return !!expected && String(token || '') === expected;
}

/** Returns { role: 'manager' } or { role: 'landlord', landlord } for a valid PIN, else null. */
function who_(pin) {
  pin = String(pin == null ? '' : pin).trim();
  if (pin) {
    var mp = prop_('MANAGER_PIN');
    if (mp && pin === String(mp).trim()) return { role: 'manager' };
    var ll = landlords_().filter(function (l) { return l.pin && l.pin === pin; })[0];
    if (ll) return { role: 'landlord', landlord: ll };
  }
  Utilities.sleep(800); // slow down guessing
  return null;
}

function manager_(pin) { var w = who_(pin); return w && w.role === 'manager' ? w : null; }

function landlords_() {
  var t = table_(LANDLORDS);
  return t.rows.map(function (r) {
    var sites = String(r[t.idx.sites] || '').split(',').map(function (s) { return s.trim(); }).filter(String);
    return {
      name: String(r[t.idx.landlord] || '').trim(),
      pin: String(r[t.idx.pin] == null ? '' : r[t.idx.pin]).trim(),
      sites: sites,
      email: String(r[t.idx.email] || '').trim()
    };
  }).filter(function (l) { return l.name; });
}

function coversSite_(landlord, site) {
  var s = String(site || '').trim().toLowerCase();
  return landlord.sites.some(function (x) { return x === '*' || x.toLowerCase() === s; });
}

function canSee_(auth, job) {
  if (!auth || !job) return false;
  if (auth.role === 'manager') return true;
  return auth.role === 'landlord' && job.sharedWithLandlord && coversSite_(auth.landlord, job.site);
}

/* ================= sheet helpers ================= */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

/** Reads a tab into { sh, idx (header -> column index), rows, width }. */
function table_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setup from the Apps Script editor.');
  var lastR = sh.getLastRow(), lastC = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastC).getValues()[0];
  var idx = {};
  headers.forEach(function (h, i) { h = String(h).trim(); if (h && idx[h] == null) idx[h] = i; });
  var rows = lastR > 1 ? sh.getRange(2, 1, lastR - 1, lastC).getValues() : [];
  return { sh: sh, name: name, key: KEYS[name], idx: idx, rows: rows, width: lastC };
}

function findRow_(t, header, value) {
  var c = t.idx[header];
  if (c == null || !value) return null;
  for (var i = t.rows.length - 1; i >= 0; i--) {
    if (String(t.rows[i][c]) === String(value)) return { i: i, row: i + 2, values: t.rows[i] };
  }
  return null;
}

/** The sheet row after the last real row (one whose key column is filled). */
function nextRow_(t) {
  var c = t.idx[t.key], last = t.sh.getLastRow();
  if (c == null || last < 2) return Math.max(2, last + 1);
  var vals = t.sh.getRange(2, c + 1, last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).trim() !== '') return i + 3;
  return 2;
}

/**
 * Adds a row from an object keyed by header name, straight after the last real row.
 * Unknown headers are left blank. Not appendRow: that goes below anything in the sheet, even empty tick boxes.
 */
function appendByHeader_(t, obj) {
  var arr = [];
  for (var i = 0; i < t.width; i++) arr.push('');
  Object.keys(obj).forEach(function (h) { if (t.idx[h] != null) arr[t.idx[h]] = obj[h]; });
  var row = nextRow_(t), max = t.sh.getMaxRows();
  if (row > max) {
    t.sh.insertRowsAfter(max, 200);
    (CHECKBOX_COLUMNS[t.name] || []).forEach(function (h) {
      if (t.idx[h] != null) t.sh.getRange(max + 1, t.idx[h] + 1, 200, 1).clearDataValidations().clearContent();
    });
  }
  t.sh.getRange(row, 1, 1, t.width).setValues([arr]);
  checkboxes_(t, row);
  if (t.rows) {
    while (t.rows.length < row - 2) t.rows.push(arr.map(function () { return ''; }));
    t.rows[row - 2] = arr;
  }
  return row;
}

function checkboxes_(t, row) {
  var cols = CHECKBOX_COLUMNS[t.name];
  if (!cols) return;
  var box = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  cols.forEach(function (h) { if (t.idx[h] != null) t.sh.getRange(row, t.idx[h] + 1).setDataValidation(box); });
}

function setCell_(t, rowNum, header, value) {
  if (t.idx[header] == null) return;
  t.sh.getRange(rowNum, t.idx[header] + 1).setValue(value);
}

function clip_(s, n) { return String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim().slice(0, n); }

/** Keeps text as text: stops Sheets running it as a formula or turning it into a number or date. */
function txt_(s) {
  s = String(s == null ? '' : s);
  if (!s) return s;
  if (/^[=+\-@]/.test(s) || /^[\d\s.,$%()\/:\-]+$/.test(s) || /^(true|false)$/i.test(s)) return "'" + s;
  return s;
}
function untxt_(s) { return String(s).replace(/^'(?=[=+\-@\d\s.,$%()\/:]|true$|false$)/i, ''); }

/** Header row only: enough to append, without reading every row of a long tab. */
function header_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setup from the Apps Script editor.');
  var lastC = Math.max(sh.getLastColumn(), 1), idx = {};
  sh.getRange(1, 1, 1, lastC).getValues()[0].forEach(function (h, i) { h = String(h).trim(); if (h && idx[h] == null) idx[h] = i; });
  return { sh: sh, name: name, key: KEYS[name], idx: idx, rows: null, width: lastC };
}

function fmtStamp_(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function fmtDay_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function today_() { return fmtDay_(new Date()); }

function toCell_(type, v) {
  if (type === 'bool') return v === true;
  if (type === 'int') return Number(v) || 0;
  if (type === 'money') return v == null || v === '' ? '' : Math.round(Number(v) * 100) / 100;
  if (type === 'date') return v ? Utilities.parseDate(String(v), TZ, 'yyyy-MM-dd') : '';
  if (type === 'datetime') return v instanceof Date ? v : (v ? new Date(v) : '');
  return txt_(v);
}

function fromCell_(type, v) {
  if (type === 'bool') return v === true || String(v).toUpperCase() === 'TRUE';
  if (type === 'int') return Number(v) || 0;
  if (type === 'money') {
    if (v === '' || v == null) return null;
    var n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
    return isFinite(n) ? n : null;
  }
  if (type === 'date') return v instanceof Date ? fmtDay_(v) : String(v || '');
  if (type === 'datetime') return v instanceof Date ? fmtStamp_(v) : String(v || '');
  if (v instanceof Date) return fmtDay_(v);
  return untxt_(v == null ? '' : v);
}

function jobFromRow_(t, r) {
  var o = {};
  JOB_FIELDS.forEach(function (f) {
    var c = t.idx[f[0]];
    o[f[1]] = fromCell_(f[2], c == null ? '' : r[c]);
  });
  if (!o.status) o.status = 'New';
  if (!o.responsibility) o.responsibility = 'TBC';
  return o;
}

function jobToCells_(job) {
  var out = {};
  JOB_FIELDS.forEach(function (f) { if (job[f[1]] !== undefined) out[f[0]] = toCell_(f[2], job[f[1]]); });
  return out;
}

function nextRef_(t) {
  var prefix = prop_('REF_PREFIX') || 'BR';
  var c = t.idx.ref, max = 0;
  t.rows.forEach(function (r) {
    var m = String(r[c] || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  var n = String(max + 1);
  while (n.length < 4) n = '0' + n;
  return prefix + '-' + n;
}

function log_(jobId, ref, who, role, type, detail, landlordCanSee) {
  var t = header_(ACTIVITY);
  appendByHeader_(t, {
    at: new Date(), job_id: txt_(jobId), ref: txt_(ref), who: txt_(clip_(who, 120)), role: role, type: type,
    detail: txt_(clip_(detail, 6000)), landlord_can_see: !!landlordCanSee
  });
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { try { lock.releaseLock(); } catch (x) {} }
}

/* ================= submit a report ================= */

function submitAction_(body) {
  if (!tokenOk_(body.token)) return { ok: false, error: 'unauthorised', permanent: true };
  var rec = body.record || {};
  var problem = validateReport_(rec);
  if (problem) return { ok: false, error: problem, permanent: true };

  var job = withLock_(function () {
    var t = table_(JOBS);
    // Idempotent: the form retries until it hears back, so return the ref we already gave this id.
    var existing = findRow_(t, 'job_id', rec.id);
    if (existing) return { duplicate: true, ref: fromCell_('text', existing.values[t.idx.ref]) };
    var now = new Date();
    var j = {
      ref: nextRef_(t), id: clip_(rec.id, LIMITS.id), submittedAt: now, status: 'New',
      priority: clip_(rec.priority, LIMITS.priority), site: clip_(rec.site, LIMITS.site), area: clip_(rec.area, LIMITS.area),
      category: clip_(rec.category, LIMITS.category), trade: clip_(rec.trade, LIMITS.trade),
      title: clip_(rec.title, LIMITS.title), description: clip_(rec.description, LIMITS.text),
      reporterName: clip_(rec.reporterName, LIMITS.name), reporterContact: clip_(rec.reporterContact, LIMITS.contact),
      voiceUsed: !!rec.voiceUsed, photosExpected: Math.max(0, Math.min(50, Number(rec.photoCount) || 0)), reportPhotos: 0,
      responsibility: 'TBC', sharedWithLandlord: false, completionPhotos: 0,
      updatedAt: now, updatedBy: clip_(rec.reporterName, LIMITS.name), clientTime: clip_(rec.clientTime, 40)
    };
    appendByHeader_(t, jobToCells_(j));
    log_(j.id, j.ref, j.reporterName, 'reporter', 'created', 'Reported: ' + j.title, false);
    return j;
  });
  if (job.duplicate) return { ok: true, duplicate: true, ref: job.ref };
  notifyNewReport_(job);
  return { ok: true, ref: job.ref };
}

function validateReport_(r) {
  if (!r.id || typeof r.id !== 'string' || r.id.length > LIMITS.id) return 'bad_id';
  if (!String(r.reporterName || '').trim()) return 'missing_name';
  if (!String(r.site || '').trim()) return 'missing_site';
  if (!String(r.category || '').trim()) return 'missing_type';
  if (!String(r.title || '').trim()) return 'missing_summary';
  return '';
}

/* ================= photos ================= */

function photoAction_(body) {
  var p = body.photo || {};
  var by;
  if (body.pin != null && body.pin !== '') {
    if (!manager_(body.pin)) return { ok: false, error: 'bad_pin', permanent: true };
    by = clip_(body.by, LIMITS.name) || 'Manager';
  } else if (tokenOk_(body.token)) {
    if (p.kind !== 'report') return { ok: false, error: 'not_allowed', permanent: true };
    by = 'Reporter';
  } else {
    return { ok: false, error: 'unauthorised', permanent: true };
  }
  if (!p.id || typeof p.id !== 'string' || p.id.length > LIMITS.id) return { ok: false, error: 'bad_photo_id', permanent: true };
  if (p.kind !== 'report' && p.kind !== 'completion') return { ok: false, error: 'bad_kind', permanent: true };
  var mime = p.mime === 'image/png' ? 'image/png' : 'image/jpeg';
  var data = String(p.data || '');
  if (!data || data.length > MAX_PHOTO_CHARS || !/^[A-Za-z0-9+\/=]+$/.test(data)) return { ok: false, error: 'bad_image', permanent: true };
  var thumb = String(p.thumb || '');
  if (thumb.length > MAX_THUMB_CHARS || !/^[A-Za-z0-9+\/=]*$/.test(thumb)) thumb = '';

  return withLock_(function () {
    var pt = table_(PHOTOS);
    if (findRow_(pt, 'photo_id', p.id)) return { ok: true, duplicate: true };
    var jt = table_(JOBS);
    var jr = findRow_(jt, 'job_id', p.jobId);
    // Not permanent: the report may still be on its way.
    if (!jr) return { ok: false, error: 'job_not_found' };
    var job = jobFromRow_(jt, jr.values);
    var folder = jobFolder_(jt, jr, job);
    var n = pt.rows.filter(function (r) { return String(r[pt.idx.job_id]) === job.id && r[pt.idx.kind] === p.kind; }).length + 1;
    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data), mime,
      job.ref + '-' + p.kind + '-' + n + (mime === 'image/png' ? '.png' : '.jpg')));
    var caption = clip_(p.caption, LIMITS.caption);
    if (caption) file.setDescription(caption);
    var now = new Date();
    appendByHeader_(pt, {
      uploaded_at: now, photo_id: txt_(p.id), job_id: txt_(job.id), ref: txt_(job.ref), kind: p.kind,
      caption: txt_(caption), annotated: !!p.annotated, uploaded_by: txt_(by), file_id: file.getId(), url: file.getUrl(), thumb: thumb
    });
    setCell_(jt, jr.row, p.kind === 'report' ? 'report_photos' : 'completion_photos', n);
    if (p.kind === 'completion') {
      setCell_(jt, jr.row, 'updated_at', now);
      setCell_(jt, jr.row, 'updated_by', txt_(by));
      log_(job.id, job.ref, by, 'manager', 'photo', 'Completion photo added' + (caption ? ': ' + caption : ''), true);
    }
    return { ok: true, photo: { id: p.id, kind: p.kind, caption: caption, annotated: !!p.annotated, uploadedAt: fmtStamp_(now) } };
  });
}

function rootFolder_() {
  var id = prop_('PHOTO_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var name = 'AFS Building Reports - Photos';
  var parent = null;
  try { var it = DriveApp.getFileById(ss_().getId()).getParents(); if (it.hasNext()) parent = it.next(); } catch (x) {}
  var folder = parent ? parent.createFolder(name) : DriveApp.createFolder(name);
  PropertiesService.getScriptProperties().setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function jobFolder_(jt, jr, job) {
  var m = String(job.photoFolder || '').match(/folders\/([A-Za-z0-9_-]+)/);
  if (m) { try { return DriveApp.getFolderById(m[1]); } catch (x) {} }
  var name = (job.ref + ' ' + job.site + ' - ' + job.title).replace(/[\/\\]+/g, '-').slice(0, 100);
  var folder = rootFolder_().createFolder(name);
  setCell_(jt, jr.row, 'photo_folder', folder.getUrl());
  return folder;
}

function photoMeta_(pt, r, withThumb) {
  var o = {
    id: fromCell_('text', r[pt.idx.photo_id]),
    jobId: fromCell_('text', r[pt.idx.job_id]),
    kind: String(r[pt.idx.kind] || ''),
    caption: fromCell_('text', r[pt.idx.caption]),
    annotated: r[pt.idx.annotated] === true,
    uploadedAt: fromCell_('datetime', r[pt.idx.uploaded_at]),
    uploadedBy: fromCell_('text', r[pt.idx.uploaded_by])
  };
  if (withThumb) o.thumb = String(r[pt.idx.thumb] || '');
  return o;
}

function photoGetAction_(p) {
  var auth = who_(p.pin);
  if (!auth) return { ok: false, error: 'bad_pin' };
  var pt = table_(PHOTOS);
  var pr = findRow_(pt, 'photo_id', p.id);
  if (!pr) return { ok: false, error: 'not_found' };
  var jt = table_(JOBS);
  var jr = findRow_(jt, 'job_id', pr.values[pt.idx.job_id]);
  if (!jr || !canSee_(auth, jobFromRow_(jt, jr.values))) return { ok: false, error: 'not_found' };
  var blob = DriveApp.getFileById(String(pr.values[pt.idx.file_id])).getBlob();
  return {
    ok: true, id: p.id, mime: blob.getContentType() || 'image/jpeg',
    data: Utilities.base64Encode(blob.getBytes()),
    url: auth.role === 'manager' ? String(pr.values[pt.idx.url] || '') : ''
  };
}

/* ================= read ================= */

function photoIndex_(withThumbsFor) {
  var pt = table_(PHOTOS), by = {};
  pt.rows.forEach(function (r) {
    var jid = String(r[pt.idx.job_id] || '');
    if (!jid) return;
    var m = by[jid] || (by[jid] = { report: 0, completion: 0, reportThumb: '', completionThumb: '' });
    var kind = r[pt.idx.kind] === 'completion' ? 'completion' : 'report';
    m[kind]++;
    if (withThumbsFor && withThumbsFor[jid] && !m[kind + 'Thumb']) m[kind + 'Thumb'] = String(r[pt.idx.thumb] || '');
  });
  return by;
}

function recent_(job) {
  if (CLOSED.indexOf(job.status) < 0) return true;
  var d = new Date(job.updatedAt || job.submittedAt);
  return !isNaN(d) && (Date.now() - d.getTime()) < LIST_THUMB_DAYS * 864e5;
}

function allJobs_() {
  var t = table_(JOBS);
  return t.rows.filter(function (r) { return r[t.idx.job_id]; }).map(function (r) { return jobFromRow_(t, r); });
}

function withPhotos_(jobs, idx) {
  return jobs.map(function (j) {
    var m = idx[j.id] || { report: 0, completion: 0 };
    j.photos = { report: m.report, completion: m.completion };
    if (m.reportThumb) j.thumb = m.reportThumb;
    if (m.completionThumb) j.completionThumb = m.completionThumb;
    return j;
  });
}

function listAction_(p) {
  if (!manager_(p.pin)) return { ok: false, error: 'bad_pin' };
  var jobs = allJobs_();
  var want = {};
  jobs.forEach(function (j) { if (recent_(j)) want[j.id] = true; });
  jobs = withPhotos_(jobs, photoIndex_(want));
  return {
    ok: true,
    role: 'manager',
    jobs: jobs.reverse(),
    landlords: landlords_().map(function (l) { return { name: l.name, sites: l.sites, hasEmail: !!l.email }; }),
    statuses: STATUSES,
    responsibility: RESPONSIBILITY,
    alerts: alerts_(),
    sheetUrl: ss_().getUrl(),
    photosUrl: prop_('PHOTO_FOLDER_ID') ? 'https://drive.google.com/drive/folders/' + prop_('PHOTO_FOLDER_ID') : ''
  };
}

/** Whether new-report emails are switched on, for the manager page. */
function alerts_() {
  var to = notifyTo_(), out = { to: to };
  try { out.quota = MailApp.getRemainingDailyQuota(); } catch (x) { out.error = String(x && x.message || x); }
  return out;
}

/** What a landlord may see of a job. Costs only show where the landlord is paying. */
function forLandlord_(j) {
  var pays = LANDLORD_PAYS.indexOf(j.responsibility) >= 0;
  return {
    id: j.id, ref: j.ref, submittedAt: j.submittedAt, status: j.status, priority: j.priority,
    site: j.site, area: j.area, category: j.category, trade: j.trade, title: j.title, description: j.description,
    responsibility: j.responsibility, landlordPays: pays, tradeCompany: j.tradeCompany,
    scheduledFor: j.scheduledFor, completedAt: j.completedAt, completionNotes: j.completionNotes, updatedAt: j.updatedAt,
    quote: pays ? j.quote : null, finalCost: pays ? j.finalCost : null, invoiceRef: pays ? j.invoiceRef : '',
    photos: j.photos, thumb: j.thumb, completionThumb: j.completionThumb
  };
}

function landlordListAction_(p) {
  var auth = who_(p.pin);
  if (!auth || auth.role !== 'landlord') return { ok: false, error: 'bad_pin' };
  var jobs = allJobs_().filter(function (j) { return canSee_(auth, j); });
  var want = {};
  jobs.forEach(function (j) { if (recent_(j)) want[j.id] = true; });
  jobs = withPhotos_(jobs, photoIndex_(want)).map(forLandlord_);
  return { ok: true, role: 'landlord', landlord: { name: auth.landlord.name, sites: auth.landlord.sites }, jobs: jobs.reverse() };
}

function detail_(id, auth) {
  var jt = table_(JOBS);
  var jr = findRow_(jt, 'job_id', id);
  if (!jr) return { ok: false, error: 'not_found' };
  var job = jobFromRow_(jt, jr.values);
  if (!canSee_(auth, job)) return { ok: false, error: 'not_found' };
  var pt = table_(PHOTOS);
  var photos = pt.rows.filter(function (r) { return String(r[pt.idx.job_id]) === job.id; }).map(function (r) { return photoMeta_(pt, r, true); });
  job.photos = {
    report: photos.filter(function (x) { return x.kind === 'report'; }).length,
    completion: photos.filter(function (x) { return x.kind === 'completion'; }).length
  };
  var at = table_(ACTIVITY);
  var activity = at.rows.filter(function (r) {
    return String(r[at.idx.job_id]) === job.id && (auth.role === 'manager' || r[at.idx.landlord_can_see] === true);
  }).map(function (r) {
    return {
      at: fromCell_('datetime', r[at.idx.at]), who: fromCell_('text', r[at.idx.who]), role: String(r[at.idx.role] || ''),
      type: String(r[at.idx.type] || ''), detail: fromCell_('text', r[at.idx.detail]), landlordCanSee: r[at.idx.landlord_can_see] === true
    };
  });
  if (auth.role === 'landlord') {
    job = forLandlord_(job);
    photos.forEach(function (x) { delete x.uploadedBy; });
    activity.forEach(function (a) { delete a.landlordCanSee; });
  }
  return { ok: true, job: job, photos: photos, activity: activity };
}

function jobAction_(p) {
  var auth = who_(p.pin);
  if (!auth) return { ok: false, error: 'bad_pin' };
  return detail_(String(p.id || ''), auth);
}

/** The report form checks on reports sent from the same phone. Job ids are random and unguessable. */
function mineAction_(p) {
  if (!tokenOk_(p.token)) return { ok: false, error: 'unauthorised' };
  var ids = String(p.ids || '').split(',').map(function (s) { return s.trim(); }).filter(String).slice(0, 50);
  var want = {};
  ids.forEach(function (i) { want[i] = true; });
  var jobs = allJobs_().filter(function (j) { return want[j.id]; }).map(function (j) {
    return { id: j.id, ref: j.ref, status: j.status, updatedAt: j.updatedAt, scheduledFor: j.scheduledFor, completedAt: j.completedAt };
  });
  return { ok: true, jobs: jobs };
}

/* ================= manager updates ================= */

function normalise_(spec, v) {
  if (spec.type === 'enum') return spec.values.indexOf(v) >= 0 ? v : undefined;
  if (spec.type === 'bool') return v === true || v === 'true';
  if (spec.type === 'date') {
    v = String(v == null ? '' : v).trim();
    return v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  }
  if (spec.type === 'money') {
    if (v == null || String(v).trim() === '') return null;
    var n = Number(String(v).replace(/[$,\s]/g, ''));
    return isFinite(n) && n >= 0 && n < 1e8 ? Math.round(n * 100) / 100 : undefined;
  }
  return clip_(v, spec.max || 200);
}

function show_(spec, v) {
  if (spec.type === 'bool') return v ? 'yes' : 'no';
  if (spec.type === 'money') return v == null ? 'blank' : '$' + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (v === '' || v == null) return 'blank';
  if (spec.type === 'text' && String(v).length > 80) return String(v).slice(0, 77) + '...';
  return String(v);
}

function updateAction_(body) {
  if (!manager_(body.pin)) return { ok: false, error: 'bad_pin' };
  var id = String(body.id || '');
  var by = clip_(body.by, LIMITS.name) || 'Manager';
  var changes = body.changes || {};
  var res = withLock_(function () {
    var jt = table_(JOBS);
    var jr = findRow_(jt, 'job_id', id);
    if (!jr) return { ok: false, error: 'not_found' };
    var job = jobFromRow_(jt, jr.values);
    var out = {}, bad = [];
    Object.keys(changes).forEach(function (k) {
      var spec = EDITABLE[k];
      if (!spec) return;
      var v = normalise_(spec, changes[k]);
      if (v === undefined) { bad.push(k); return; }
      if (v === job[k]) return;
      out[k] = v;
    });
    if (bad.length) return { ok: false, error: 'bad_value', fields: bad };
    var status = out.status || job.status;
    if (out.status === 'Completed' && !('completedAt' in out) && !job.completedAt) out.completedAt = today_();
    if (out.status && CLOSED.indexOf(status) < 0 && job.completedAt && !('completedAt' in out)) out.completedAt = '';
    var keys = Object.keys(out);
    if (!keys.length) return { ok: true, unchanged: true };

    var now = new Date();
    keys.forEach(function (k) {
      var f = JOB_FIELDS.filter(function (x) { return x[1] === k; })[0];
      setCell_(jt, jr.row, f[0], toCell_(f[2], out[k]));
    });
    setCell_(jt, jr.row, 'updated_at', now);
    setCell_(jt, jr.row, 'updated_by', txt_(by));
    keys.forEach(function (k) {
      var spec = EDITABLE[k];
      if (k === 'sharedWithLandlord') {
        log_(job.id, job.ref, by, 'manager', 'shared', out[k] ? 'Shared with the landlord' : 'No longer shared with the landlord', !!out[k]);
      } else if (k === 'completionNotes') {
        log_(job.id, job.ref, by, 'manager', 'field', 'Completion notes updated', false);
      } else {
        log_(job.id, job.ref, by, 'manager', k === 'status' ? 'status' : 'field',
          spec.label + ': ' + show_(spec, job[k]) + ' → ' + show_(spec, out[k]), LANDLORD_VISIBLE_FIELDS.indexOf(k) >= 0);
      }
    });
    return { ok: true };
  });
  if (!res.ok || res.unchanged) return res.ok ? detail_(id, { role: 'manager' }) : res;
  return detail_(id, { role: 'manager' });
}

function noteAction_(body) {
  if (!manager_(body.pin)) return { ok: false, error: 'bad_pin' };
  var text = clip_(body.text, LIMITS.note);
  if (!text) return { ok: false, error: 'empty' };
  var by = clip_(body.by, LIMITS.name) || 'Manager';
  var toLandlord = body.landlord === true;
  var res = withLock_(function () {
    var jt = table_(JOBS);
    var jr = findRow_(jt, 'job_id', String(body.id || ''));
    if (!jr) return { ok: false, error: 'not_found' };
    var job = jobFromRow_(jt, jr.values);
    if (toLandlord && !job.sharedWithLandlord) return { ok: false, error: 'not_shared' };
    log_(job.id, job.ref, by, 'manager', toLandlord ? 'message' : 'note', text, toLandlord);
    setCell_(jt, jr.row, 'updated_at', new Date());
    setCell_(jt, jr.row, 'updated_by', txt_(by));
    return { ok: true, id: job.id };
  });
  return res.ok ? detail_(res.id, { role: 'manager' }) : res;
}

function landlordCommentAction_(body) {
  var auth = who_(body.pin);
  if (!auth || auth.role !== 'landlord') return { ok: false, error: 'bad_pin' };
  var text = clip_(body.text, LIMITS.note);
  if (!text) return { ok: false, error: 'empty' };
  var name = clip_(body.name, LIMITS.name);
  var who = name ? name + ' (' + auth.landlord.name + ')' : auth.landlord.name;
  var res = withLock_(function () {
    var jt = table_(JOBS);
    var jr = findRow_(jt, 'job_id', String(body.id || ''));
    if (!jr) return { ok: false, error: 'not_found' };
    var job = jobFromRow_(jt, jr.values);
    if (!canSee_(auth, job)) return { ok: false, error: 'not_found' };
    log_(job.id, job.ref, who, 'landlord', 'landlord_comment', text, true);
    setCell_(jt, jr.row, 'updated_at', new Date());
    setCell_(jt, jr.row, 'updated_by', txt_(who));
    return { ok: true, job: job };
  });
  if (!res.ok) return res;
  notifyLandlordComment_(res.job, who, text);
  return detail_(res.job.id, auth);
}

/* ================= email ================= */

function siteUrl_() {
  var u = prop_('SITE_URL') || DEFAULT_SITE_URL;
  return /\/$/.test(u) ? u : u + '/';
}

function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function emailHtml_(heading, intro, rows, linkText, link) {
  var table = rows.filter(function (r) { return r[1]; }).map(function (r) {
    return '<tr><td style="padding:6px 14px 6px 0;color:#6F6A61;vertical-align:top;white-space:nowrap">' + esc_(r[0]) +
      '</td><td style="padding:6px 0;color:#232323;vertical-align:top;white-space:pre-wrap">' + esc_(r[1]) + '</td></tr>';
  }).join('');
  return '<div style="font-family:Lato,Tahoma,Arial,sans-serif;font-size:15px;line-height:1.5;color:#232323;max-width:600px">' +
    '<div style="background:#0E2A44;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
    '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#F26422;font-weight:700">The AFS Group &middot; Building reports</div>' +
    '<div style="font-size:20px;font-weight:700;margin-top:4px">' + esc_(heading) + '</div></div>' +
    '<div style="background:#fff;border:1px solid #D9D4CA;border-top:0;padding:18px 22px;border-radius:0 0 10px 10px">' +
    (intro ? '<p style="margin:0 0 12px">' + esc_(intro) + '</p>' : '') +
    '<table style="border-collapse:collapse;font-size:14px">' + table + '</table>' +
    '<p style="margin:18px 0 0"><a href="' + esc_(link) + '" style="display:inline-block;background:#0E2A44;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">' + esc_(linkText) + '</a></p>' +
    '</div></div>';
}

/** NOTIFY_EMAIL, tidied: commas, semicolons or spaces between addresses all work. */
function notifyTo_() {
  var props = PropertiesService.getScriptProperties().getProperties(), raw = props.NOTIFY_EMAIL;
  if (raw == null) {
    // Forgive small slips in the property name, like "Notify email" or a trailing space.
    Object.keys(props).forEach(function (k) { if (raw == null && k.replace(/[\s_-]/g, '').toUpperCase() === 'NOTIFYEMAIL') raw = props[k]; });
  }
  return String(raw || '').split(/[,;\s]+/).filter(function (e) { return /@/.test(e); }).join(',');
}

/** Records an email attempt in the job's history, so a failure is visible on the manager page. */
function logEmail_(job, ok, detail) {
  try { withLock_(function () { log_(job.id, job.ref, 'System', 'system', 'email', (ok ? 'Email sent: ' : 'Email failed: ') + detail, false); }); }
  catch (x) { Logger.log('Could not log email result: ' + x); }
}

function notifyNewReport_(job) {
  var to = notifyTo_();
  if (!to) return;
  try {
    MailApp.sendEmail({
      to: to,
      name: 'AFS Building Reports',
      subject: (job.priority === 'Urgent' ? 'URGENT: ' : '') + job.ref + ' ' + job.site + ': ' + job.title,
      htmlBody: emailHtml_(job.ref + ': ' + job.title, 'A new building report has come in.', [
        ['Priority', job.priority], ['Site', job.site], ['Where', job.area], ['Type', job.category], ['Trade', job.trade],
        ['Details', job.description], ['Reported by', job.reporterName + (job.reporterContact ? ' (' + job.reporterContact + ')' : '')],
        ['Photos', job.photosExpected ? job.photosExpected + ' on the way' : 'None']
      ], 'Open the job', siteUrl_() + 'manage.html#' + job.ref)
    });
    logEmail_(job, true, 'new report to ' + to);
  } catch (err) {
    Logger.log('New report email failed: ' + err);
    logEmail_(job, false, 'new report to ' + to + ' (' + (err && err.message || err) + ')');
  }
}

function notifyLandlordComment_(job, who, text) {
  var to = notifyTo_();
  if (!to) return;
  try {
    MailApp.sendEmail({
      to: to,
      name: 'AFS Building Reports',
      subject: 'Landlord comment on ' + job.ref + ': ' + job.title,
      htmlBody: emailHtml_(job.ref + ': ' + job.title, who + ' commented:', [['Comment', text], ['Site', job.site], ['Status', job.status]],
        'Open the job', siteUrl_() + 'manage.html#' + job.ref)
    });
  } catch (err) {
    Logger.log('Landlord comment email failed: ' + err);
    logEmail_(job, false, 'landlord comment to ' + to + ' (' + (err && err.message || err) + ')');
  }
}

function emailLandlordAction_(body) {
  if (!manager_(body.pin)) return { ok: false, error: 'bad_pin' };
  var by = clip_(body.by, LIMITS.name) || 'Manager';
  var jt = table_(JOBS);
  var jr = findRow_(jt, 'job_id', String(body.id || ''));
  if (!jr) return { ok: false, error: 'not_found' };
  var job = jobFromRow_(jt, jr.values);
  if (!job.sharedWithLandlord) return { ok: false, error: 'not_shared' };
  var targets = landlords_().filter(function (l) { return l.email && coversSite_(l, job.site); });
  if (!targets.length) return { ok: false, error: 'no_landlord_email' };
  var pays = LANDLORD_PAYS.indexOf(job.responsibility) >= 0;
  var cost = pays && job.finalCost != null ? job.finalCost : (pays && job.quote != null ? job.quote : null);
  var note = clip_(body.message, LIMITS.note);
  targets.forEach(function (l) {
    MailApp.sendEmail({
      to: l.email,
      name: 'The AFS Group',
      subject: job.ref + ' ' + job.site + ': ' + job.title + ' (' + job.status + ')',
      htmlBody: emailHtml_(job.ref + ': ' + job.title,
        note || 'The AFS Group has shared an update on this job with you. Open it to see the photos and the full history.', [
          ['Status', job.status], ['Site', job.site], ['Where', job.area], ['Type', job.category], ['Priority', job.priority],
          ['Details', job.description], ['Scheduled for', job.scheduledFor], ['Completed on', job.completedAt],
          ['Completion notes', job.completionNotes],
          ['Cost (' + (job.finalCost != null ? 'final' : 'quote') + ', ex GST)', cost != null ? '$' + cost.toFixed(2) : '']
        ], 'View the job', siteUrl_() + 'landlord.html#' + job.ref)
    });
  });
  var names = targets.map(function (l) { return l.name; }).join(', ');
  withLock_(function () {
    log_(job.id, job.ref, by, 'manager', 'email', 'Emailed ' + names + (note ? ': ' + note : ''), false);
  });
  return { ok: true, sent: targets.map(function (l) { return l.name; }) };
}
