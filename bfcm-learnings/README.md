# BFCM Learnings

Staff record what they learned from Black Friday / Cyber Monday by typing or speaking. Leadership reviews every response on a dashboard, and Claude summarises them into what to keep, what to fix, and the changes to make in the business.

Responses land in a Google Sheet, like the showroom check-in form.

| Page | Who uses it | Link |
|---|---|---|
| `index.html` | All staff | `https://the-afs-group.github.io/bfcm-learnings/` |
| `dash.html` | Leadership (PIN) | `https://the-afs-group.github.io/bfcm-learnings/dash.html` |
| `dash.html?demo` | Anyone, before setup | Shows the dashboard with made-up data |

| File | What it is |
|---|---|
| `config.js` | The only file to edit after setup: endpoint, token, event name, departments, team suggestions, brands |
| `apps-script/Code.gs` | Google Apps Script that stores responses and calls Claude for the summary |
| `demo-data.js` | Made-up responses for `?demo`. Safe to delete. |

## What staff see

1. **About you:** name, department (dropdown, plus Other) and team (free text with suggestions). Remembered on their device for next time.
2. **Which brand is this about?** Optional chips, including Other with a box to type the brand.
3. **Your learnings:** three boxes, with at least one required:
   - What worked? (keep doing)
   - What didn't work? (fix)
   - What should we do differently next time? (try)

Each box has a **Speak** button. Tap it, talk, and the words appear in the box. It keeps listening through pauses until tapped again. Staff can edit the text afterwards. They can submit as many times as they like.

Drafts are saved on the device as people type. Submissions are saved on the device first and retried every 30 seconds until the Sheet confirms them, so a dropped connection loses nothing.

## One-time setup (about 10 minutes)

1. Create a Google Sheet called **AFS BFCM Learnings**. Open **Extensions → Apps Script** and replace the default code with `apps-script/Code.gs`.
2. **Project Settings → Script properties**, add:
   - `SUBMIT_TOKEN`: any long random string. It goes in `config.js` too.
   - `VIEW_PIN`: a PIN for the dashboard. Share it only with the people reviewing.
   - `ANTHROPIC_API_KEY`: optional. Turns on the Claude summary button (see below).
3. Run `setup` once from the editor and approve the permissions. It creates the **Responses** and **Summaries** tabs.
4. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Copy the `/exec` URL.
5. In `config.js`, set `ENDPOINT` to that URL and `TOKEN` to the `SUBMIT_TOKEN` value. Check the department, team and brand lists.
6. Commit and publish. After any later change to `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

Until `ENDPOINT` is set, the form shows a red "Setup needed" note and keeps responses only on that device.

## The Claude summary

With `ANTHROPIC_API_KEY` set, the dashboard shows **Summarise with Claude**. It sends every response for the event to Claude and shows:

- a short headline of how the event went
- **Keep doing** and **Fix** lists, with the departments behind each point and how many people raised it
- themes that cut across departments
- **Bringing it into the business**: specific actions, each with an owning department, a type (quick win, process change, systems, people, bigger project) and a timeframe (now, before the next sale, before next year)
- one line per department, and open questions to check against data

Summaries are saved to the **Summaries** tab, so everyone sees the same one until someone re-runs it. The dashboard shows how many responses have come in since the last run. You can also run it from the Sheet: **BFCM Learnings → Summarise latest event with Claude**.

Staff names are not sent to Claude, only department, team, brand and the three answers. The summary refers to departments, not people.

Optional script properties:

| Property | Default | Use |
|---|---|---|
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model for the summary |
| `CLAUDE_EFFORT` | `medium` | `low` is faster. Use it if a summary times out with a lot of responses. |

The API key lives only in the Apps Script properties. It is never in the page or the repo.

**No API key?** Click **Copy for Claude** on the dashboard. It copies every response for the event with the summary instructions, ready to paste into a Claude chat. Or ask Claude, with the Google Drive connector, to read the **AFS BFCM Learnings** Sheet and write the review.

## Voice typing

Voice typing uses the browser's built-in speech recognition (Web Speech API), set to Australian English.

- **Works in:** Chrome and Edge on desktop and Android, Safari on Mac and iPhone.
- **Not in:** Firefox, or some in-app browsers. The page says so and suggests using the keyboard's microphone key instead.
- The first tap asks for microphone permission.
- The page keeps no audio, only the text. The browser's speech service converts the audio: Google's in Chrome, Apple's in Safari. Staff should type, not speak, anything sensitive.
- The dashboard marks responses that used voice as "dictated", since speech-to-text can mishear words.

## The dashboard

`dash.html` asks for the `VIEW_PIN`, then shows:

- response, people and department counts
- responses by department, and **Still to hear from**: departments in `config.js` with no responses yet, so you know who to nudge
- the Claude summary
- every response, filterable by department, team and brand, with search
- **Download CSV** and **Copy for Claude**

It refreshes every two minutes while open.

## Next event

Change `EVENT`, `EVENT_LABEL` and `HEADLINE` in `config.js`, for example `BFCM 2027` or `Boxing Day 2026`. New responses carry the new event name. The dashboard gets an event picker once the Sheet has more than one, and each event keeps its own summary.

## Security notes

- The token in `config.js` is visible in the page source. It can only add responses. Reading needs the PIN, which is not in the page.
- Wrong PINs are slowed down. Change `VIEW_PIN` after the review if the PIN was shared widely.
- The pages are `noindex`, but the URL is public. Don't put anything confidential in `config.js`.
- Staff text that starts with `=`, `+`, `-` or `@` is stored as plain text, so it can't run as a Sheets formula.
