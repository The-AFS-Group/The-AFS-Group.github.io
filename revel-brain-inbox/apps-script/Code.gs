/**
 * Revel Brain Inbox: Google Apps Script backend.
 *
 * Bound to the "Revel Brain Inbox" Google Sheet (Extensions > Apps Script). Three ways in, and each
 * submission gets a reference (BRAIN-0001), a Drive folder, a tracker row, an email to the approvers
 * and a receipt to the person who sent it:
 *
 *   1. Upload page   revel-brain-inbox/index.html calls doPost: begin -> upload (per file) -> finish
 *   2. Email         staff email documents to INTAKE_ADDRESS; tick() reads Gmail every 10 minutes
 *   3. Drive folder  files dropped in "Drop files here"; tick() picks them up every 10 minutes
 *
 * Once GITHUB_TOKEN is set, tick() also commits each submission's files to the private Brain repo
 * (branch inbox/brain-0001, folder sources/inbox/BRAIN-0001/) and opens a "brain-inbox" issue, which
 * starts Claude's draft. GitHub Actions report back (doPost action "status"): the tracker row updates
 * and people are emailed ("Ready for your approval", "Live", ...).
 *
 * Script properties (Project Settings > Script properties):
 *   TEAM_CODE        code staff type on the upload page. Not in the page source. Required.
 *   NOTIFY_EMAILS    the approvers, comma separated. They get every submission, every draft that's
 *                    ready for approval, anything that needs attention and the weekly digest. Required.
 *   STATUS_TOKEN     long random string. Same value as the GitHub secret BRAIN_INBOX_STATUS_TOKEN.
 *   INTAKE_ADDRESS   address staff email documents to. Must reach the Gmail of the account this
 *                    script runs as, e.g. that account's plus address (name+brain@domain).
 *   ALLOWED_DOMAINS  sender domains accepted by the email route. Default: revelsaunas.com
 *   GITHUB_TOKEN     fine-grained token, revel-brain repo only, Contents + Issues read/write.
 *   GITHUB_REPO      default The-AFS-Group/revel-brain
 *   PAGE_URL         default https://the-afs-group.github.io/revel-brain-inbox/
 * setup() adds INBOX_FOLDER_ID, DROP_FOLDER_ID, SUBMISSIONS_FOLDER_ID and NEXT_REF.
 *
 * Privacy: submitter emails stay in this Sheet. GitHub gets the submitter's name and team only.
 */

var TZ = 'Australia/Brisbane';
var SUBS = 'Submissions';
var FILES = 'Files';
var LOG = 'Log';
var SUB_HEADERS = ['ref', 'received_at', 'channel', 'name', 'email', 'team', 'product', 'topic', 'doc_type',
  'markets', 'confidential', 'note', 'files', 'drive_folder', 'github_issue', 'pr_url', 'status',
  'status_at', 'status_note', 'sync_attempts'];
var FILE_HEADERS = ['ref', 'received_at', 'file_name', 'mime', 'size_kb', 'drive_url', 'drive_id', 'repo_path'];
var LOG_HEADERS = ['time', 'event', 'detail'];

var TEAMS = ['Sales', 'Customer service & warranty', 'Marketing', 'Showroom', 'Ops & logistics', 'Product',
  'Offshore team', 'Management', 'Other'];
var TOPICS = ['Specs', 'Electrical', 'Install', 'Warranty', 'Care', 'Compliance', 'FAQ', 'Policy', 'Not sure'];
var DOC_TYPES = ['Factory spec sheet', 'Tech pack', 'Compliance certificate or test report', 'Manual or install guide',
  'Customer service answers / FAQ', 'Correction (no file)', 'Other'];
var MARKETS = ['AU', 'NZ', 'US'];
var MAX_FILE_MB = 25;          // upload page limit per file
var MAX_COMMIT_MB = 30;        // larger files stay in Drive and are linked from the GitHub issue
var MAX_FILES = 25;

/* ================================================================ setup */

/** Run once from the editor. Creates tabs, Drive folders, the Gmail label and the 10-minute trigger. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  ensureSheet_(ss, SUBS, SUB_HEADERS);
  ensureSheet_(ss, FILES, FILE_HEADERS);
  ensureSheet_(ss, LOG, LOG_HEADERS);
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0) ss.deleteSheet(def);
  ss.getSheetByName(SUBS).getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm');
  ss.getSheetByName(SUBS).getRange('R:R').setNumberFormat('yyyy-mm-dd hh:mm');

  var props = PropertiesService.getScriptProperties();
  var inbox = folderById_(props.getProperty('INBOX_FOLDER_ID')) || DriveApp.createFolder('Revel Brain Inbox');
  var drop = folderById_(props.getProperty('DROP_FOLDER_ID')) || inbox.createFolder('Drop files here');
  var subs = folderById_(props.getProperty('SUBMISSIONS_FOLDER_ID')) || inbox.createFolder('Submissions');
  props.setProperties({
    INBOX_FOLDER_ID: inbox.getId(), DROP_FOLDER_ID: drop.getId(), SUBMISSIONS_FOLDER_ID: subs.getId()
  });
  if (!props.getProperty('NEXT_REF')) props.setProperty('NEXT_REF', '1');
  if (!props.getProperty('STATUS_TOKEN')) props.setProperty('STATUS_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  gmailLabel_('Brain Inbox/Processed');
  gmailLabel_('Brain Inbox/Rejected');

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(10).create();

  Logger.log('Brain Inbox folder: ' + inbox.getUrl());
  Logger.log('Drop folder (share with staff as Editor): ' + drop.getUrl());
  Logger.log('STATUS_TOKEN (copy to GitHub secret BRAIN_INBOX_STATUS_TOKEN): ' + props.getProperty('STATUS_TOKEN'));
  checkSettings();
}

/** Lists missing settings. Run any time from the editor. */
function checkSettings() {
  var p = PropertiesService.getScriptProperties().getProperties();
  var need = ['TEAM_CODE', 'NOTIFY_EMAILS', 'STATUS_TOKEN'];
  var nice = ['INTAKE_ADDRESS', 'GITHUB_TOKEN'];
  need.forEach(function (k) { Logger.log((p[k] ? 'OK      ' : 'MISSING ') + k); });
  nice.forEach(function (k) { Logger.log((p[k] ? 'OK      ' : 'not set ') + k + (k === 'GITHUB_TOKEN' ? ' (files stay in Drive until set)' : ' (email route off until set)')); });
  Logger.log('Runs as ' + Session.getEffectiveUser().getEmail() + '. INTAKE_ADDRESS must deliver to this mailbox.');
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#2B2B2B').setFontColor('#FFFFFF');
  sh.setFrozenRows(1);
  return sh;
}

function folderById_(id) {
  if (!id) return null;
  try { return DriveApp.getFolderById(id); } catch (e) { return null; }
}

function gmailLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function prop_(k, dflt) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return v === null || v === '' ? (dflt === undefined ? '' : dflt) : v;
}

/* ================================================================ web app */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'begin': return json_(withCode_(body, begin_));
      case 'upload': return json_(withCode_(body, upload_));
      case 'finish': return json_(withCode_(body, finish_));
      case 'status': return json_(withToken_(body, statusUpdate_));
      case 'digest': return json_(withToken_(body, digest_));
      default: return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    log_('error', 'doPost: ' + err);
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'config') {
    return json_(withCode_(p, function () {
      return { ok: true, intakeAddress: prop_('INTAKE_ADDRESS'), maxFileMb: MAX_FILE_MB, maxFiles: MAX_FILES,
        dropFolder: prop_('DROP_FOLDER_ID') ? 'https://drive.google.com/drive/folders/' + prop_('DROP_FOLDER_ID') : '' };
    }));
  }
  if (p.action === 'track') return json_(withCode_(p, track_));
  return json_({ ok: true, service: 'revel-brain-inbox' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function withCode_(body, fn) {
  var code = prop_('TEAM_CODE');
  if (!code || String(body.code || '').trim() !== code) {
    Utilities.sleep(700);
    return { ok: false, error: 'bad_code' };
  }
  return fn(body);
}

function withToken_(body, fn) {
  var t = prop_('STATUS_TOKEN');
  if (!t || body.token !== t) return { ok: false, error: 'unauthorised' };
  return fn(body);
}

/* ---------------- upload page: begin / upload / finish */

function clean_(s, max) { return String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200); }
function cleanNote_(s) { return String(s || '').replace(/\r/g, '').trim().slice(0, 5000); }

function begin_(body) {
  var s = body.submission || {};
  var name = clean_(s.name, 80), email = clean_(s.email, 120).toLowerCase();
  if (!name) return { ok: false, error: 'missing_name' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'bad_email' };
  var note = cleanNote_(s.note);
  if (!note && !(s.fileCount > 0)) return { ok: false, error: 'empty' };
  var markets = (s.markets || []).filter(function (m) { return MARKETS.indexOf(m) >= 0; });
  var rec = {
    channel: s.channel === 'ask-claude' ? 'Ask Claude' : 'Upload page',
    name: name, email: email,
    team: TEAMS.indexOf(s.team) >= 0 ? s.team : 'Other',
    product: clean_(s.product, 160),
    topic: TOPICS.indexOf(s.topic) >= 0 ? s.topic : 'Not sure',
    docType: DOC_TYPES.indexOf(s.docType) >= 0 ? s.docType : 'Other',
    markets: markets.join(', '),
    confidential: !!s.confidential,
    note: note
  };
  var sub = createSubmission_(rec, 'Uploading');
  var key = Utilities.getUuid();
  CacheService.getScriptCache().put('up_' + sub.ref, JSON.stringify({ key: key, folder: sub.folderId }), 21600);
  return { ok: true, ref: sub.ref, key: key };
}

function upload_(body) {
  var c = CacheService.getScriptCache().get('up_' + body.ref);
  if (!c) return { ok: false, error: 'expired', permanent: true };
  c = JSON.parse(c);
  if (c.key !== body.key) return { ok: false, error: 'bad_key', permanent: true };
  var name = safeName_(body.name || 'file');
  var bytes = Utilities.base64Decode(String(body.data || ''));
  if (!bytes.length) return { ok: false, error: 'empty_file', permanent: true };
  if (bytes.length > MAX_FILE_MB * 1024 * 1024) return { ok: false, error: 'too_large', permanent: true };
  var folder = DriveApp.getFolderById(c.folder);
  var existing = folder.getFilesByName(name);
  if (existing.hasNext()) return { ok: true, duplicate: true };   // a retry of a file we already have
  var file = folder.createFile(Utilities.newBlob(bytes, clean_(body.mime, 120) || 'application/octet-stream', name));
  logFile_(body.ref, file);
  return { ok: true, id: file.getId() };
}

function finish_(body) {
  var c = CacheService.getScriptCache().get('up_' + body.ref);
  if (!c || JSON.parse(c).key !== body.key) return { ok: false, error: 'expired' };
  var row = findRow_(body.ref);
  if (!row) return { ok: false, error: 'not_found' };
  var files = filesFor_(body.ref);
  setCells_(row.index, { files: files.length, status: 'Received', status_at: new Date(), status_note: '' });
  var rec = readRow_(row.index);
  announce_(rec, files);
  CacheService.getScriptCache().remove('up_' + body.ref);
  return { ok: true, ref: body.ref, trackUrl: trackUrl_(body.ref) };
}

/* ---------------- shared submission helpers */

function nextRef_() {
  // Document lock, not the script lock tick() holds, so refs stay unique across requests.
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var n = parseInt(props.getProperty('NEXT_REF') || '1', 10);
    props.setProperty('NEXT_REF', String(n + 1));
    return 'BRAIN-' + ('000' + n).slice(-4);
  } finally {
    lock.releaseLock();
  }
}

function createSubmission_(rec, status) {
  var ref = nextRef_();
  var parent = DriveApp.getFolderById(prop_('SUBMISSIONS_FOLDER_ID'));
  var label = [ref, rec.product || 'General', rec.name].join(' · ').slice(0, 120);
  var folder = parent.createFolder(label);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBS);
  var now = new Date();
  sh.appendRow([ref, now, rec.channel, rec.name, rec.email, rec.team, rec.product, rec.topic, rec.docType,
    rec.markets, rec.confidential, rec.note, 0, folder.getUrl(), '', '', status, now, '', 0]);
  return { ref: ref, folderId: folder.getId(), folder: folder };
}

function logFile_(ref, file) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES).appendRow([
    ref, new Date(), file.getName(), file.getMimeType(), Math.round(file.getSize() / 1024),
    file.getUrl(), file.getId(), ''
  ]);
}

function safeName_(n) {
  n = String(n).replace(/[\\/:*?"<>|#%{}^~\[\]`]+/g, '-').replace(/\s+/g, ' ').trim();
  return (n || 'file').slice(0, 120);
}

function findRow_(ref) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBS);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var refs = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = refs.length - 1; i >= 0; i--) if (refs[i][0] === ref) return { index: i + 2 };
  return null;
}

function readRow_(index) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBS);
  var v = sh.getRange(index, 1, 1, SUB_HEADERS.length).getValues()[0];
  var o = {};
  SUB_HEADERS.forEach(function (h, i) { o[h] = v[i]; });
  o.index = index;
  return o;
}

function setCells_(index, values) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBS);
  Object.keys(values).forEach(function (k) {
    var col = SUB_HEADERS.indexOf(k);
    if (col >= 0) sh.getRange(index, col + 1).setValue(values[k]);
  });
}

function filesFor_(ref) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, FILE_HEADERS.length).getValues()
    .map(function (r, i) { return { row: i + 2, ref: r[0], name: r[2], mime: r[3], kb: r[4], url: r[5], id: r[6], repoPath: r[7] }; })
    .filter(function (f) { return f.ref === ref; });
}

function trackUrl_(ref) {
  return prop_('PAGE_URL', 'https://the-afs-group.github.io/revel-brain-inbox/') + '#track=' + ref;
}

function log_(event, detail) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG).appendRow([new Date(), event, String(detail).slice(0, 2000)]);
  } catch (e) { /* logging must never break a request */ }
}

/* ================================================================ timed work */

/** Every 10 minutes: email route, Drive drop folder, then GitHub. */
function tick() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;     // a previous tick is still running
  try {
    try { scanEmail_(); } catch (e) { log_('error', 'email: ' + e); }
    try { scanDropFolder_(); } catch (e) { log_('error', 'drive: ' + e); }
    try { syncPending_(start); } catch (e) { log_('error', 'github: ' + e); }
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- email route */

function scanEmail_() {
  var addr = prop_('INTAKE_ADDRESS').toLowerCase();
  if (!addr) return;
  var allowed = prop_('ALLOWED_DOMAINS', 'revelsaunas.com').toLowerCase().split(/[,\s]+/).filter(String);
  var done = gmailLabel_('Brain Inbox/Processed'), rejected = gmailLabel_('Brain Inbox/Rejected');
  var q = '{to:' + addr + ' deliveredto:' + addr + ' cc:' + addr + '} -label:"Brain Inbox/Processed" -label:"Brain Inbox/Rejected" newer_than:14d';
  var me = Session.getEffectiveUser().getEmail().toLowerCase();
  GmailApp.search(q, 0, 20).forEach(function (thread) {
    var accepted = 0;
    thread.getMessages().forEach(function (m) {
      var from = parseFrom_(m.getFrom());
      var domain = from.email.split('@')[1] || '';
      if (/^\[Brain\]/.test(m.getSubject())) return;                     // our own notifications
      if (from.email === me && m.getTo().toLowerCase().indexOf(addr) < 0) return;
      if (allowed.indexOf(domain) < 0) { log_('email rejected', from.email + ': ' + m.getSubject()); return; }
      var rec = {
        channel: 'Email', name: from.name || from.email.split('@')[0], email: from.email, team: 'Other',
        product: '', topic: 'Not sure', docType: 'Other', markets: '', confidential: false,
        note: ('Subject: ' + m.getSubject() + '\n\n' + stripQuoted_(m.getPlainBody())).slice(0, 5000)
      };
      var sub = createSubmission_(rec, 'Received');
      var atts = m.getAttachments({ includeInlineImages: false, includeAttachments: true })
        .filter(function (a) { return !/\.(ics|vcf|p7s)$/i.test(a.getName()) && a.getSize() > 0; })
        .slice(0, MAX_FILES);
      atts.forEach(function (a) {
        var f = sub.folder.createFile(a.copyBlob().setName(safeName_(a.getName())));
        logFile_(sub.ref, f);
      });
      var row = findRow_(sub.ref);
      setCells_(row.index, { files: atts.length });
      announce_(readRow_(row.index), filesFor_(sub.ref));
      accepted++;
    });
    thread.addLabel(accepted ? done : rejected);
  });
}

function parseFrom_(s) {
  var m = String(s).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim(), email: m[2].trim().toLowerCase() } : { name: '', email: String(s).trim().toLowerCase() };
}

function stripQuoted_(t) {
  var lines = String(t || '').split('\n'), out = [];
  for (var i = 0; i < lines.length; i++) {
    if (/^On .+wrote:\s*$/.test(lines[i]) || /^-{2,}\s*Original Message/i.test(lines[i]) || /^From: /.test(lines[i])) break;
    if (/^>/.test(lines[i])) continue;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

/* ---------------- Drive drop folder */

function scanDropFolder_() {
  var drop = folderById_(prop_('DROP_FOLDER_ID'));
  if (!drop) return;
  var props = PropertiesService.getScriptProperties();
  var seen = JSON.parse(props.getProperty('DROP_SEEN') || '[]');
  var byOwner = {};
  var it = drop.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (seen.indexOf(f.getId()) >= 0) continue;                                // copied on an earlier run
    if (Date.now() - f.getLastUpdated().getTime() < 2 * 60 * 1000) continue;   // still uploading
    var owner = '';
    try { owner = f.getOwner() ? f.getOwner().getEmail() : ''; } catch (e) { owner = ''; }
    (byOwner[owner] = byOwner[owner] || []).push(f);
  }
  Object.keys(byOwner).forEach(function (owner) {
    var files = byOwner[owner].slice(0, MAX_FILES);
    var rec = {
      channel: 'Drive folder', name: owner ? owner.split('@')[0] : 'Drive drop', email: owner, team: 'Other',
      product: '', topic: 'Not sure', docType: 'Other', markets: '', confidential: false,
      note: 'Dropped in the Brain Inbox Drive folder: ' + files.map(function (f) { return f.getName(); }).join(', ')
    };
    var sub = createSubmission_(rec, 'Received');
    files.forEach(function (f) {
      try {
        f.moveTo(sub.folder);
        logFile_(sub.ref, f);
      } catch (e) {
        // Drive only lets the owner move a file; copy it instead and remember the original.
        logFile_(sub.ref, f.makeCopy(f.getName(), sub.folder));
        seen.push(f.getId());
      }
    });
    props.setProperty('DROP_SEEN', JSON.stringify(seen.slice(-400)));
    var row = findRow_(sub.ref);
    setCells_(row.index, { files: files.length });
    announce_(readRow_(row.index), filesFor_(sub.ref));
  });
}

/* ---------------- GitHub: commit files, open the inbox issue */

function gh_(method, path, payload) {
  var res = UrlFetchApp.fetch('https://api.github.com' + path, {
    method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + prop_('GITHUB_TOKEN'), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: payload ? JSON.stringify(payload) : undefined
  });
  var code = res.getResponseCode(), text = res.getContentText();
  var data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { code: code, data: data };
}

function syncPending_(start) {
  if (!prop_('GITHUB_TOKEN')) return;
  var repo = prop_('GITHUB_REPO', 'The-AFS-Group/revel-brain');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBS);
  var last = sh.getLastRow();
  if (last < 2) return;
  var rows = sh.getRange(2, 1, last - 1, SUB_HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (Date.now() - start > 4.5 * 60 * 1000) return;     // stay inside the 6-minute limit
    var status = rows[i][SUB_HEADERS.indexOf('status')], issue = rows[i][SUB_HEADERS.indexOf('github_issue')];
    if (status !== 'Received' || issue) continue;
    var rec = readRow_(i + 2);
    try {
      var url = pushToGitHub_(repo, rec);
      setCells_(rec.index, { github_issue: url, status: 'Sent to Claude', status_at: new Date(), status_note: 'Claude is drafting the card' });
    } catch (e) {
      var tries = (Number(rec.sync_attempts) || 0) + 1;
      setCells_(rec.index, { sync_attempts: tries });
      log_('github sync failed', rec.ref + ' (try ' + tries + '): ' + e);
      if (tries === 5) {
        setCells_(rec.index, { status: 'Needs attention', status_at: new Date(), status_note: 'Could not reach GitHub: ' + String(e).slice(0, 200) });
        mailApprovers_('[Brain] Needs attention: ' + rec.ref, '<p>' + rec.ref + ' could not be sent to GitHub after 5 tries.</p><p>' + esc_(String(e)) + '</p>');
      }
    }
  }
}

function pushToGitHub_(repo, rec) {
  var ref = rec.ref, branch = 'inbox/' + ref.toLowerCase(), dir = 'sources/inbox/' + ref;
  var main = gh_('get', '/repos/' + repo + '/git/ref/heads/main');
  if (main.code !== 200) throw new Error('read main: HTTP ' + main.code);
  var mk = gh_('post', '/repos/' + repo + '/git/refs', { ref: 'refs/heads/' + branch, sha: main.data.object.sha });
  if (mk.code !== 201 && mk.code !== 422) throw new Error('create branch: HTTP ' + mk.code);

  var files = filesFor_(ref), linked = [];
  files.forEach(function (f) {
    var path = dir + '/' + safeName_(f.name);
    if (f.repoPath) return;                                   // already committed on an earlier try
    var file = DriveApp.getFileById(f.id);
    if (file.getSize() > MAX_COMMIT_MB * 1024 * 1024) { linked.push(f); return; }
    var put = gh_('put', '/repos/' + repo + '/contents/' + encodePath_(path), {
      message: ref + ': add ' + f.name, branch: branch, content: Utilities.base64Encode(file.getBlob().getBytes())
    });
    if (put.code !== 201 && put.code !== 200 && put.code !== 422) throw new Error('upload ' + f.name + ': HTTP ' + put.code);
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES).getRange(f.row, FILE_HEADERS.indexOf('repo_path') + 1).setValue(path);
  });

  var meta = [
    '# ' + ref, '',
    '| | |', '|---|---|',
    '| Received | ' + Utilities.formatDate(new Date(rec.received_at), TZ, 'yyyy-MM-dd HH:mm') + ' |',
    '| Channel | ' + rec.channel + ' |',
    '| Submitted by | ' + md_(rec.name) + ' (' + md_(rec.team) + ') |',
    '| Product | ' + md_(rec.product || 'Not given: work it out from the files') + ' |',
    '| Topic | ' + rec.topic + ' |',
    '| Document type | ' + rec.doc_type + ' |',
    '| Markets | ' + (rec.markets || 'Not given') + ' |',
    '| Confidential | ' + (rec.confidential ? 'Yes: supplier, cost or factory detail goes in internal/ only' : 'No') + ' |',
    '', '## What\'s new or wrong', '', String(rec.note || '(no note)'), '',
    '## Files', ''
  ];
  files.forEach(function (f) {
    var big = linked.indexOf(f) >= 0;
    meta.push('- `' + dir + '/' + safeName_(f.name) + '` (' + f.kb + ' KB)' + (big ? ' **too large to attach: open it in Drive** ' + f.url : ''));
  });
  if (!files.length) meta.push('- None (text-only request)');
  var put2 = gh_('put', '/repos/' + repo + '/contents/' + encodePath_(dir + '/submission.md'), {
    message: ref + ': submission details', branch: branch, content: Utilities.base64Encode(meta.join('\n'), Utilities.Charset.UTF_8)
  });
  if (put2.code !== 201 && put2.code !== 200 && put2.code !== 422) throw new Error('submission.md: HTTP ' + put2.code);

  // Don't open a second issue if an earlier try got this far.
  var found = gh_('get', '/repos/' + repo + '/issues?labels=brain-inbox&state=all&per_page=50');
  if (found.code === 200) {
    for (var i = 0; i < found.data.length; i++) if (found.data[i].title.indexOf(ref + ' ') === 0) return found.data[i].html_url;
  }
  var title = [ref, rec.product || 'Product to identify', rec.topic].join(' · ') + ': ' + String(rec.note || 'files').split('\n')[0].replace(/^Subject: /, '').slice(0, 60);
  var labels = ['brain-inbox'];
  if (rec.topic === 'FAQ') labels.push('faq-candidate');
  var issue = gh_('post', '/repos/' + repo + '/issues', {
    title: title.slice(0, 120), labels: labels,
    body: meta.join('\n') + '\n\n<!-- brain-inbox ref=' + ref + ' branch=' + branch + ' -->\n'
  });
  if (issue.code !== 201) throw new Error('create issue: HTTP ' + issue.code);
  return issue.data.html_url;
}

function encodePath_(p) { return p.split('/').map(encodeURIComponent).join('/'); }
function md_(s) { return String(s || '').replace(/\|/g, '/').replace(/\n/g, ' '); }

/* ================================================================ status from GitHub */

var SUBMITTER_MESSAGES = {
  'In review': 'Claude has drafted the change and it is now with Tristan and Ben for approval.',
  'Changes requested': null,
  'Live': 'It has been approved by Tristan and Ben and is now live in the Brain.',
  'Not accepted': 'Tristan and Ben decided not to add this to the Brain. Reply to this email if you want to know why.',
  'No change needed': 'The Brain already covers this, so nothing needed to change.',
  'Needs attention': null
};

function statusUpdate_(body) {
  var refs = (body.refs || []).filter(function (r) { return /^BRAIN-\d+$/.test(r); });
  var status = clean_(body.status, 40), url = clean_(body.url, 300), note = cleanNote_(body.note).slice(0, 1500);
  refs.forEach(function (ref) {
    var row = findRow_(ref);
    if (!row) return;
    var before = readRow_(row.index);
    var cells = { status: status, status_at: new Date(), status_note: note };
    if (url && /\/pull\/\d+/.test(url)) cells.pr_url = url;
    setCells_(row.index, cells);
    var rec = readRow_(row.index);
    var changed = before.status !== status;
    if (changed && SUBMITTER_MESSAGES[status] && rec.email) {
      MailApp.sendEmail({
        to: rec.email, name: 'Revel Brain', subject: '[Brain] ' + ref + ': ' + status,
        htmlBody: shell_('<p>Hi ' + esc_(String(rec.name).split(' ')[0]) + ',</p><p>Your Brain submission <b>' + ref + '</b> (' +
          esc_(rec.product || String(rec.note || '').slice(0, 60)) + '): ' + SUBMITTER_MESSAGES[status] + '</p>' +
          (note ? '<p style="color:#555">' + esc_(note) + '</p>' : '') +
          '<p><a href="' + trackUrl_(ref) + '">Track it in the Brain Inbox</a></p>')
      });
    }
    if (changed && status === 'In review' && before.status !== 'Changes requested') {
      mailApprovers_('[Brain] Ready for your approval: ' + ref + (rec.product ? ' · ' + rec.product : ''),
        '<p><b>' + ref + '</b> from ' + esc_(rec.name) + ' has a draft waiting for both of you.</p>' +
        (note ? '<p>' + esc_(note) + '</p>' : '') +
        (url ? '<p><a href="' + url + '" style="font-weight:bold">Review and approve on GitHub</a> (works in the GitHub mobile app)</p>' : '') +
        '<p style="color:#555">Approve or request changes within 5 business days.</p>');
    }
    if (changed && status === 'Needs attention') {
      mailApprovers_('[Brain] Needs attention: ' + ref, '<p>' + esc_(note) + '</p>' + (url ? '<p><a href="' + url + '">Details</a></p>' : ''));
    }
  });
  return { ok: true, updated: refs.length };
}

function digest_(body) {
  var md = String(body.markdown || '').slice(0, 20000);
  mailApprovers_('[Brain] Weekly digest', mdToHtml_(md));
  return { ok: true };
}

/* ================================================================ email */

/** New submission: tell the approvers, send a receipt to the submitter. */
function announce_(rec, files) {
  var list = files.length ? '<ul>' + files.map(function (f) {
    return '<li><a href="' + f.url + '">' + esc_(f.name) + '</a> (' + f.kb + ' KB)</li>';
  }).join('') + '</ul>' : '<p>No files: text only.</p>';
  var rows = [['From', esc_(rec.name) + (rec.email ? ' &lt;' + esc_(rec.email) + '&gt;' : '') + ' · ' + esc_(rec.team)],
    ['Via', esc_(rec.channel)], ['Product', esc_(rec.product || 'not given')], ['Topic', esc_(rec.topic)],
    ['Document', esc_(rec.doc_type)], ['Markets', esc_(rec.markets || 'not given')],
    ['Confidential', rec.confidential ? '<b>Yes</b>' : 'No']];
  var table = '<table cellpadding="4" style="border-collapse:collapse">' + rows.map(function (r) {
    return '<tr><td style="color:#555;vertical-align:top">' + r[0] + '</td><td>' + r[1] + '</td></tr>';
  }).join('') + '</table>';
  mailApprovers_('[Brain] New submission ' + rec.ref + (rec.product ? ' · ' + rec.product : '') + ' from ' + rec.name,
    table + '<p style="white-space:pre-wrap">' + esc_(rec.note || '') + '</p>' + list +
    '<p><a href="' + rec.drive_folder + '">Open the Drive folder</a> · <a href="' + trackUrl_(rec.ref) + '">Tracker</a></p>' +
    '<p style="color:#555">' + (prop_('GITHUB_TOKEN') ? 'Claude will draft the card within about 15 minutes and send it to you both for approval.'
      : 'GitHub isn\'t connected yet, so this stays in Drive until it is.') + '</p>');
  if (rec.email) {
    MailApp.sendEmail({
      to: rec.email, name: 'Revel Brain', subject: '[Brain] Got it: ' + rec.ref,
      htmlBody: shell_('<p>Hi ' + esc_(String(rec.name).split(' ')[0]) + ',</p><p>Thanks. Your submission is logged as <b>' + rec.ref +
        '</b>' + (files.length ? ' with ' + files.length + ' file' + (files.length > 1 ? 's' : '') : '') + '.</p>' +
        '<p>What happens next: Claude drafts the Brain card, Tristan and Ben both approve it, and we email you when it\'s live.</p>' +
        '<p><a href="' + trackUrl_(rec.ref) + '">Track it in the Brain Inbox</a></p>')
    });
  }
}

function mailApprovers_(subject, html) {
  var to = prop_('NOTIFY_EMAILS');
  if (!to) { log_('no NOTIFY_EMAILS', subject); return; }
  MailApp.sendEmail({ to: to, name: 'Revel Brain', subject: subject, htmlBody: shell_(html) });
}

function shell_(inner) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1d1d1b;max-width:620px">' +
    inner + '<p style="color:#888;font-size:12px;border-top:1px solid #ddd;padding-top:8px;margin-top:20px">Revel Wellness Brain · internal</p></div>';
}

function esc_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Just enough Markdown for the digest: headings, bullets, tables, links, bold. */
function mdToHtml_(md) {
  var out = [], inList = false, inTable = false;
  md.split('\n').forEach(function (line) {
    var l = esc_(line).replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    if (/^\|/.test(line)) {
      if (/^\|[\s\-|]+\|$/.test(line)) return;
      if (!inTable) { out.push('<table cellpadding="4" style="border-collapse:collapse">'); inTable = true; }
      out.push('<tr>' + l.split('|').slice(1, -1).map(function (c) { return '<td style="border-bottom:1px solid #eee">' + c.trim() + '</td>'; }).join('') + '</tr>');
      return;
    }
    if (inTable) { out.push('</table>'); inTable = false; }
    if (/^- /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + l.replace(/^- (\[ \] )?/, '') + '</li>');
      return;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (/^#{1,3} /.test(line)) out.push('<h3>' + l.replace(/^#+ /, '') + '</h3>');
    else if (line.trim()) out.push('<p>' + l + '</p>');
  });
  if (inTable) out.push('</table>');
  if (inList) out.push('</ul>');
  return out.join('\n');
}

/* ================================================================ tracker */

function track_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBS);
  var last = sh.getLastRow(), out = [];
  if (last >= 2) {
    var start = Math.max(2, last - 199);
    sh.getRange(start, 1, last - start + 1, SUB_HEADERS.length).getValues().forEach(function (r) {
      var o = {};
      SUB_HEADERS.forEach(function (h, i) { o[h] = r[i]; });
      out.push({
        ref: o.ref, received: o.received_at instanceof Date ? Utilities.formatDate(o.received_at, TZ, 'd MMM yyyy') : '',
        channel: o.channel, name: String(o.name || '').split(' ')[0], product: o.product, topic: o.topic,
        files: o.files, status: o.status, updated: o.status_at instanceof Date ? Utilities.formatDate(o.status_at, TZ, 'd MMM') : '',
        note: String(o.status_note || '').slice(0, 200), pr: o.pr_url
      });
    });
  }
  out.reverse();
  return { ok: true, rows: out };
}

/* ================================================================ tests */

/** Run from the editor: makes a test submission with a small text file and emails the approvers. */
function testSubmission() {
  var rec = { channel: 'Upload page', name: 'Brain Test', email: Session.getEffectiveUser().getEmail(), team: 'Product',
    product: 'Revel Aura 2 Person Full Spectrum Infrared Sauna - Next Gen', topic: 'Electrical', docType: 'Correction (no file)',
    markets: 'AU', confidential: false, note: 'Test submission from testSubmission(). Safe to ignore.' };
  var sub = createSubmission_(rec, 'Received');
  var f = sub.folder.createFile(Utilities.newBlob('Test file for the Brain Inbox.', 'text/plain', 'test.txt'));
  logFile_(sub.ref, f);
  var row = findRow_(sub.ref);
  setCells_(row.index, { files: 1 });
  announce_(readRow_(row.index), filesFor_(sub.ref));
  Logger.log('Created ' + sub.ref + ': ' + sub.folder.getUrl());
}
