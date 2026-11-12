# AFS Building Reports

Staff at Arundel EC and Molendinar Warehouse report building damage, maintenance and site requirements from their phone: typed or spoken, with photos they can mark up. The facilities manager triages each job, books a trade, tracks status, and closes it out with completion photos and the final bill. Landlords see the jobs shared with them and can reply.

Everything lands in one Google Sheet. Photos are saved to a Google Drive folder, one folder per job.

| Page | Who uses it | Link |
|---|---|---|
| `index.html` | Staff at Arundel EC and Molendinar Warehouse | `https://the-afs-group.github.io/building-reports/` |
| `manage.html` | Facilities manager (manager PIN) | `https://the-afs-group.github.io/building-reports/manage.html` |
| `landlord.html` | Landlords (their own PIN) | `https://the-afs-group.github.io/building-reports/landlord.html` |
| `manage.html?demo`, `landlord.html?demo` | Anyone, before setup | Made-up jobs, to show how the pages work |

| File | What it is |
|---|---|
| `config.js` | The only file to edit after setup: endpoint, token, sites, report types, priorities, trades |
| `apps-script/Code.gs` | Google Apps Script that stores jobs and photos, and sends the emails |
| `assets/br.css`, `assets/br.js` | Shared styles, photo capture and mark-up, voice typing |
| `demo-data.js` | Made-up jobs for `?demo`. Safe to delete. |

## What staff see

1. **About you:** name, and a phone or email (optional). Remembered on their device.
2. **Where is it?** Arundel EC or Molendinar Warehouse, and where on site.
3. **What's the issue?** Type (Damage, Maintenance or Building requirement), how urgent, a short summary, details (typed or tap **Speak**), and the trade it might need.
4. **Photos:** up to 8. **Take a photo** opens the camera; **Choose photos** picks from the library. Tapping a photo opens the mark-up editor: draw, arrow, circle and label, in four colours, with undo. Each photo can have a caption.

They get a reference number (`BR-0001`) when it's sent, and **Your recent reports** shows the status of everything sent from that phone.

Reports are saved on the phone first and retried every 30 seconds until the Sheet confirms them, so a weak signal on site loses nothing. The draft, including photos and mark-up, is also kept on the phone while they fill it in, because some phones reload the page after the camera closes.

## What the facilities manager sees

`manage.html` asks for the manager's name (for the job history) and the manager PIN. It shows:

- **Tiles that filter the list:** open jobs, new jobs to triage, urgent or high, open jobs the landlord pays for, completed jobs with no final cost yet, and spend this financial year.
- **Every job**, filterable by status, site, type, priority and who pays, with search. Most urgent first by default.
- **Open jobs by site.**
- **Links** to the staff form, the landlord page, the Sheet and the photos folder, and the landlords who are set up.

Opening a job shows the report and photos (tap for full size, with a link to the file in Drive), then:

| Section | What you can do |
|---|---|
| Status and trade | Status, priority, type, trade needed, trade booked and contact, scheduled date, quote, and who pays. Correct the site, location or summary if needed. |
| Landlord | Share the job with the landlord, email them a link, or copy the link. |
| Completion and bill | Completed date, final cost, invoice or bill reference, paid, what was done, and **completion photos** (take, choose, mark up, caption, upload). **Mark completed** sets the status and date and takes you to the cost. |
| Notes and history | Internal notes, messages to the landlord, and every change with who made it and when. |

Statuses: New, Acknowledged, Quoting, Awaiting approval, Scheduled, In progress, On hold, Completed, Cancelled. Setting **Completed** fills in today's date if it's blank.

Who pays: Not decided yet, AFS, Landlord, Split with landlord (`Shared` in the Sheet), Insurance, Warranty.

Costs are entered ex GST.

## What landlords see

`landlord.html` asks for the landlord's PIN. They see only the jobs you've shared, and only at their sites:

- the report, location, photos and status
- the trade, scheduled date, completion date, completion notes and completion photos
- your messages to them, and status changes
- quote, final cost and invoice reference **only when the landlord pays** (Landlord or Split)

They don't see staff names or contact details, internal notes, or costs that AFS is paying. They can reply on each job; replies show in the job history and are emailed to `NOTIFY_EMAIL`. The page has a **Print** button for a job sheet.

## One-time setup (about 15 minutes)

1. Create a Google Sheet called **AFS Building Reports**. Open **Extensions → Apps Script** and replace the default code with `apps-script/Code.gs`.
2. **Project Settings → Script properties**, add:
   - `SUBMIT_TOKEN`: the `TOKEN` value already in `config.js` (or a new long random string, put in both places).
   - `MANAGER_PIN`: a PIN for the facilities manager.
   - `NOTIFY_EMAIL`: optional. Who to email when a report comes in or a landlord replies. Comma-separated.
3. Run `setup` once from the editor and approve the permissions (Sheets, Drive, and sending email). It creates the **Jobs**, **Photos**, **Activity** and **Landlords** tabs and an **AFS Building Reports - Photos** folder next to the Sheet. It's safe to run again.
4. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Copy the `/exec` URL.
5. In `config.js`, set `ENDPOINT` to that URL. `SITES` lists Arundel EC and Molendinar Warehouse; add a site there if one is ever needed.
6. Add landlords to the **Landlords** tab (see below).
7. Share the Sheet and the photos folder with whoever needs them in Google Drive.
8. Commit and publish. After any later change to `Code.gs`, follow **Updating the code** below so the URL stays the same.

Until `ENDPOINT` is set, the form shows a red "Setup needed" note and keeps reports only on that device.

To check emails, choose **testEmail** in the function dropdown and click **Run**. It sends a test email to `NOTIFY_EMAIL`, or shows the error if it can't.

### If something doesn't arrive

- **Reports not in the Sheet:** check the Activity tab. Every report adds a `created` row there. If you set this up before 13 November 2026, paste the latest `Code.gs`, run **setup** again, and deploy a new version (see below). Earlier versions put new jobs below 1,000 rows of empty tick boxes, and setup moves them back to the top.
- **No emails:** run **testEmail**. Each job's history (and the Activity tab) records `Email sent` or `Email failed` with the reason. The manager page's **Links** panel says whether email alerts are on.

### Updating the code

Paste the new `Code.gs` over the old one, save, run **setup**, then **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The URL stays the same, so `config.js` doesn't change.

### Adding a landlord

One row per landlord in the **Landlords** tab:

| Column | Example | Notes |
|---|---|---|
| `landlord` | `Smith Property Group` | Shown on their page |
| `pin` | `482913` | Different for each landlord, and not the manager PIN. The column is plain text, so leading zeros are kept. |
| `sites` | `Molendinar Warehouse` | `Arundel EC`, `Molendinar Warehouse`, or both separated by a comma. Spelled exactly as in `config.js`. `*` means every site. |
| `email` | `facilities@smithproperty.example` | Optional. Used by **Email the landlord**. |

No code change or redeploy is needed. Send them the landlord page link and their PIN.

## The Sheet

| Tab | What's in it |
|---|---|
| **Jobs** | One row per report: ref, status, priority, site, type, summary, details, reporter, who pays, shared with landlord, trade, scheduled date, quote, final cost, invoice ref, paid, completed date, completion notes, photo counts and a link to the job's photo folder. Costs are numbers, so you can total them. |
| **Photos** | One row per photo: job, report or completion, caption, marked up or not, and a link to the file in Drive. The `thumb` column holds a small preview the pages use. Leave it alone. |
| **Activity** | Every job's history. `landlord_can_see` controls what shows on the landlord page. |
| **Landlords** | See above. |

You can edit the Sheet directly (for example to bulk-update statuses) and the pages pick it up. Columns are found by their header, so you can add your own columns. Don't rename the existing headers.

Optional script properties:

| Property | Default | Use |
|---|---|---|
| `SITE_URL` | `https://the-afs-group.github.io/building-reports/` | Base for links in emails |
| `REF_PREFIX` | `BR` | Job reference prefix |

## Photos

- Resized on the phone to 1600px on the longest side before upload, so a report sends quickly even on 4G.
- Marked-up photos are saved with the mark-up drawn in.
- Each job gets its own Drive folder, named `BR-0001 Site - Summary`. Files are `BR-0001-report-1.jpg`, `BR-0001-completion-1.jpg` and so on, with the caption as the file description.
- The files stay private to the Drive account that deployed the script. The pages fetch them through the script, using the manager or landlord PIN.

## Voice typing

The **Speak** button uses the browser's speech recognition, set to Australian English. It works in Chrome and Edge (desktop and Android) and Safari (Mac and iPhone), not in Firefox. The page keeps only the text. The browser's speech service handles the audio (Google's in Chrome, Apple's in Safari), so staff should type anything sensitive.

## Security notes

- The token in `config.js` is visible in the page source. It can only add reports and report photos, and check the status of reports by their random ID. It can't list or read other reports.
- The manager PIN reads and changes everything. Landlord PINs read only shared jobs at that landlord's sites, and can only add comments.
- Wrong PINs are slowed down. Change a PIN in Script properties (manager) or the Landlords tab (landlord) if it has been shared too widely.
- The pages are `noindex`, but the URLs are public. Don't put anything confidential in `config.js`.
- Text that starts with `=`, `+`, `-` or `@`, or looks like a number or date, is stored as plain text, so it can't run as a formula and phone numbers keep their leading zero.
