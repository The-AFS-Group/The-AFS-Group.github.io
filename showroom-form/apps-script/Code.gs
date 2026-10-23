/**
 * AFS Showroom Check-in: Google Sheets backend.
 *
 * Bound to the "AFS Showroom Check-ins" spreadsheet (Extensions > Apps Script).
 * Script Properties required (Project Settings > Script properties):
 *   SUBMIT_TOKEN  random string; same value as TOKEN in showroom-form/config.js. Write-only.
 *   STAFF_PIN     PIN staff type on today.html to view submissions. Read-only.
 *
 * Tabs:
 *   Submissions  cleaned rows, one per customer. This is the tab to extract for NetSuite matching.
 *   Raw          exactly what the customer typed, append-only audit trail.
 */

var TZ = 'Australia/Sydney';
var CLEAN_SHEET = 'Submissions';
var RAW_SHEET = 'Raw';

var CLEAN_HEADERS = [
  'submitted_at', 'submission_id', 'store', 'brand', 'first_name', 'last_name',
  'email', 'phone', 'marketing_opt_in', 'heard_about_us', 'heard_other',
  'email_key', 'phone_key', 'data_flags',
  // Filled later by the NetSuite conversion match (90-day window from submitted_at)
  'match_status', 'ns_customer_id', 'ns_first_order_date', 'days_to_convert', 'ns_order_total'
];
var RAW_HEADERS = [
  'received_at', 'submission_id', 'client_time', 'store', 'brand', 'name_raw',
  'email_raw', 'phone_raw', 'marketing_opt_in', 'heard_about_us', 'heard_other'
];

var BRANDS = ['Gym and Fitness', 'Revel Saunas', 'WaterRower / Nohrd', 'NordicTrack + iFIT'];
var SOURCES = ['Google search', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'Friend or family',
  'Walked past or saw the store', 'Email', 'Podcast or influencer', 'Returning customer', 'Other'];

/** Run once from the editor after pasting the script. Creates tabs, headers and formats. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  ensureSheet_(ss, CLEAN_SHEET, CLEAN_HEADERS);
  ensureSheet_(ss, RAW_SHEET, RAW_HEADERS);
  var clean = ss.getSheetByName(CLEAN_SHEET);
  // Text format on id/phone/key columns so Sheets never reformats "+614..." or drops leading zeros.
  [2, 8, 12, 13].forEach(function (c) { clean.getRange(2, c, clean.getMaxRows() - 1, 1).setNumberFormat('@'); });
  clean.getRange(2, 1, clean.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  clean.getRange(2, 17, clean.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
  var raw = ss.getSheetByName(RAW_SHEET);
  [2, 7, 8].forEach(function (c) { raw.getRange(2, c, raw.getMaxRows() - 1, 1).setNumberFormat('@'); });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#0E2A44').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  return sh;
}

/* ---------------- web app ---------------- */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SUBMIT_TOKEN');
    if (!expected || body.token !== expected) return json_({ ok: false, error: 'unauthorised', permanent: true });

    var rec = body.record || {};
    var problem = validate_(rec);
    if (problem) return json_({ ok: false, error: problem, permanent: true });

    lock.waitLock(20000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var clean = ss.getSheetByName(CLEAN_SHEET);
    var raw = ss.getSheetByName(RAW_SHEET);

    // Idempotent: the tablet retries until it hears back, so ignore ids we already hold.
    if (idExists_(clean, rec.id)) return json_({ ok: true, duplicate: true });

    var now = new Date();
    raw.appendRow([
      now, rec.id, rec.clientTime || '', rec.store || '', rec.brand,
      (rec.firstName || '') + ' ' + (rec.lastName || ''),
      rec.email || '', rec.phone || '', !!rec.marketingOptIn,
      rec.heard, rec.heardOther || ''
    ]);

    var flags = [];
    var first = cleanName_(rec.firstName), last = cleanName_(rec.lastName);
    var email = cleanEmail_(rec.email);
    if (rec.email && !email.valid) flags.push('email_invalid');
    var ph = cleanPhone_(rec.phone);
    if (rec.phone && !ph.valid) flags.push('phone_invalid');
    if (email.fixed) flags.push('email_typo_fixed');
    if (!email.value && !ph.value) flags.push('no_contact');

    var row = clean.getLastRow() + 1;
    clean.getRange(row, 1, 1, 14).setValues([[
      now, rec.id, rec.store || '', rec.brand, first, last,
      email.value, ph.e164, !!rec.marketingOptIn, rec.heard, String(rec.heardOther || '').slice(0, 80),
      email.value, ph.key, flags.join(', ')
    ]]);
    clean.getRange(row, 15).setValue('pending');
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action !== 'today') return json_({ ok: true, service: 'afs-showroom-form' });
  var pin = PropertiesService.getScriptProperties().getProperty('STAFF_PIN');
  if (!pin || p.pin !== pin) {
    Utilities.sleep(800);
    return json_({ ok: false, error: 'bad_pin' });
  }
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLEAN_SHEET);
  var last = sh.getLastRow();
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var out = [];
  if (last >= 2) {
    var start = Math.max(2, last - 499); // newest 500 rows is plenty for one day
    var vals = sh.getRange(start, 1, last - start + 1, 14).getValues();
    vals.forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      if (Utilities.formatDate(r[0], TZ, 'yyyy-MM-dd') !== today) return;
      if (p.store && r[2] !== p.store) return;
      out.push({
        time: Utilities.formatDate(r[0], TZ, 'h:mm a'), store: r[2], brand: r[3],
        name: (r[4] + ' ' + r[5]).trim(), email: r[6], phone: r[7],
        optIn: r[8] === true, heard: r[9], heardOther: r[10], flags: r[13]
      });
    });
  }
  out.reverse();
  return json_({ ok: true, date: today, rows: out });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- validation + cleaning ---------------- */

function validate_(r) {
  if (!r.id || typeof r.id !== 'string' || r.id.length > 80) return 'bad_id';
  if (BRANDS.indexOf(r.brand) < 0) return 'bad_brand';
  if (SOURCES.indexOf(r.heard) < 0) return 'bad_source';
  if (!String(r.firstName || '').trim()) return 'missing_name';
  if (!String(r.email || '').trim() && !String(r.phone || '').trim()) return 'missing_contact';
  return '';
}

function idExists_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) return true;
  return false;
}

/** Fixes casing word by word, only where a word is all-lower or all-upper, so "McDonald" and "de Souza" survive. */
function cleanName_(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return s.split(' ').map(function (w) {
    if (w !== w.toLowerCase() && w !== w.toUpperCase()) return w;
    if (w.length > 1 && w === w.toLowerCase() && /^(de|da|van|von|bin|al|la|le|du)$/.test(w)) return w;
    return w.toLowerCase()
      .replace(/(^|[\-'\u2019])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/^Mc([a-z])/, function (m, c) { return 'Mc' + c.toUpperCase(); });
  }).join(' ');
}

var DOMAIN_FIXES = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.con': 'gmail.com',
  'gnail.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'icoud.com': 'icloud.com', 'icloud.con': 'icloud.com', 'bigpond.con': 'bigpond.com'
};

function cleanEmail_(s) {
  var v = String(s || '').trim().toLowerCase().replace(/[\s,;]+$/g, '').replace(/\.$/, '');
  if (!v) return { value: '', valid: true, fixed: false };
  var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  var fixed = false;
  if (valid) {
    var parts = v.split('@'), dom = parts[1];
    if (DOMAIN_FIXES[dom]) { v = parts[0] + '@' + DOMAIN_FIXES[dom]; fixed = true; }
  }
  return { value: valid ? v : '', valid: valid, fixed: fixed };
}

/**
 * Australian-first phone normaliser.
 * Returns e164 (e.g. +61412345678) and key (last 9 digits; the NetSuite match key,
 * robust to 04xx / +614xx / spaces / brackets in the NetSuite phone field).
 */
function cleanPhone_(s) {
  var raw = String(s || '').trim();
  if (!raw) return { e164: '', key: '', valid: true };
  var plus = raw.charAt(0) === '+';
  var d = raw.replace(/\D/g, '');
  if (plus) { /* already international */ }
  else if (d.indexOf('0061') === 0) d = d.slice(2);
  else if (d.charAt(0) === '0') d = '61' + d.slice(1);
  else if (d.length === 9 && /^[2-478]/.test(d)) d = '61' + d;
  var valid;
  if (d.indexOf('61') === 0) valid = /^61[23478]\d{8}$/.test(d);
  else valid = d.length >= 8 && d.length <= 15 && plus;
  if (!valid) return { e164: '', key: '', valid: false };
  return { e164: '+' + d, key: d.slice(-9), valid: true };
}

/** Quick self-test: run from the editor, check View > Logs. */
function testCleaning() {
  var phones = ['0412 345 678', '+61 412 345 678', '(02) 9876 5432', '412345678', '0061412345678', '123', '+1 415 555 2671'];
  phones.forEach(function (p) { Logger.log(p + ' -> ' + JSON.stringify(cleanPhone_(p))); });
  Logger.log(cleanName_('JOHN o\'brien') + ' | ' + cleanName_('McDonald') + ' | ' + cleanName_('mary-jane SMITH'));
  Logger.log(JSON.stringify(cleanEmail_('  Bob@GMIAL.com ')));
}
