# AFS Showroom Check-in

Tablet form: **Who are you here to shop?** → details → **How did you hear about us?** → thank you.
Entries land in the Google Sheet [AFS Showroom Check-ins](https://docs.google.com/spreadsheets/d/1HWXbWJx45JUdzzBc5JV5ZKTPjaVk1BZJYz-vIEQvogI/edit), cleaned for matching against NetSuite sales.

| File | What it is |
|---|---|
| `index.html` | The customer form (tablet). Open `.../showroom-form/?store=Showroom` |
| `today.html` | Staff view of today's submissions (PIN protected) |
| `config.js` | The only file to edit after setup: endpoint, token, privacy link |
| `apps-script/Code.gs` | Google Apps Script that receives, cleans and writes the rows |
| `sw.js`, `manifest.webmanifest` | Lets the page open offline and run full-screen |

## One-time setup

1. Open the Sheet → **Extensions → Apps Script**. Replace the default code with `apps-script/Code.gs`.
2. **Project Settings → Script properties**, add:
   - `SUBMIT_TOKEN` = any long random string (goes in `config.js` too)
   - `STAFF_PIN` = a PIN for staff (4-8 digits)
3. Run `setup` once from the editor and approve permissions. Optionally run `testCleaning` and check the log.
4. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Copy the `/exec` URL.
5. Put the URL in `config.js` as `ENDPOINT`, and the token as `TOKEN`. Set `PRIVACY_URL` to the privacy policy page.
6. Commit and publish. After a code change to `Code.gs`, use **Deploy → Manage deployments → Edit → New version** (the URL stays the same).

## On the tablet

- Open `https://the-afs-group.github.io/showroom-form/?store=Showroom` (use the store name you want in the Sheet).
- iPad: Share → Add to Home Screen, then turn on **Guided Access** (Settings → Accessibility) to lock it in the form. Android: use a kiosk / screen pinning mode.
- The page resets after 90 seconds idle and 6 seconds after a submission.
- Entries are saved on the tablet first and retried every 30 seconds, so wifi drops don't lose data. A small "N waiting to send" note shows if any are queued.
- A red "Setup needed" note shows until `ENDPOINT` is set.

## Staff view

`https://the-afs-group.github.io/showroom-form/today.html` (add `?store=Showroom` to filter by store). Enter the staff PIN. It shows today's count by brand and every submission, refreshing each minute.

## What the Sheet holds

**Submissions** (use this tab for NetSuite matching)

| Column | Notes |
|---|---|
| `submitted_at` | Sydney time, `yyyy-mm-dd hh:mm:ss` |
| `submission_id` | Unique per submission; retries never create duplicates |
| `store`, `brand`, `heard_about_us`, `heard_other` | As chosen |
| `first_name`, `last_name` | Casing fixed only where typed all-lower or all-upper |
| `email` / `email_key` | Trimmed and lowercased; common domain typos fixed (e.g. `gmial.com`) |
| `phone` | E.164, e.g. `+61412345678` |
| `phone_key` | Last 9 digits, e.g. `412345678`. Match on this: it ignores `04…` vs `+614…`, spaces and brackets |
| `marketing_opt_in` | TRUE / FALSE |
| `data_flags` | `email_invalid`, `phone_invalid`, `email_typo_fixed`, `no_contact` |
| `match_status` … `ns_order_total` | Filled by the NetSuite match. Starts as `pending`. |

**Raw** holds exactly what the customer typed. Never edited.

## NetSuite conversion match (next step)

Match each Submissions row to NetSuite customers by `email_key`, falling back to `phone_key` (last 9 digits of the customer's phone). A conversion is a sales order dated from the submission date up to 90 days later. Write back `match_status`, `ns_customer_id`, `ns_first_order_date`, `days_to_convert` and `ns_order_total`.

## Security notes

- The token in `config.js` is visible in the page source. It can only add rows. Reading data needs the staff PIN, which is not in the page.
- The pages are `noindex`, but the URL is public. Keep the tablet locked to the form.
- Logos: Gym and Fitness and Revel are from this repo. AFS Group is the group's hosted logo. WaterRower/Nohrd and NordicTrack are copied from their websites. Swap in approved files from Marketing if you have them (same filenames in `assets/`).
