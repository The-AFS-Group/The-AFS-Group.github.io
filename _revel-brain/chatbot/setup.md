# Brain chatbot · Phase 1 setup (Claude Project)

Phase 1 is a shared Claude Project that reads the `revel-brain` repository's `main` branch. There's
no build, and because `main` only ever holds approved content, the bot can't see drafts.

## Before you start

- A Claude **Team or Enterprise** plan, so the project can be shared, with a seat for everyone in
  the pilot (CS and sales first). If the offshore team can't have seats, that's the trigger for
  the Phase 2 custom bot.
- The `revel-brain` repo exists and at least one seed PR is merged (otherwise there's nothing Live
  to answer from).
- The person setting it up can read `revel-brain` on GitHub (Ben).

## Steps

1. In Claude (claude.ai), **Projects > Create project**, named *Revel Wellness Brain*.
2. **Set project instructions:** paste everything below the line in `chatbot/project-instructions.md`.
3. **Add content > GitHub.** Connect GitHub if asked, pick `The-AFS-Group/revel-brain`, and select:
   `INDEX.md`, `cards/`, `compliance/`, `policies/`, `faq/` and `internal/`.
   Leave out `sources/` (raw PDFs), `scripts/`, `seed/`, `templates/`, `docs/` and `.github/`.
4. **Share** the project with the pilot group (CS and sales) as *Can use*. Keep *Can edit* to Ben and
   Tristan so nobody changes the instructions.
5. **Test** with the plan's example: "What circuit does the 4-person traditional sauna need in NZ?"
   It should answer from the Tampere 4P electrical card, cite the card and its approval date, and
   point out that the card is AU-only.

## Keeping it current

The GitHub content in a project is a synced copy. After approvals are merged, refresh the GitHub
content in the project's knowledge panel (the Monday digest is a good reminder) and check that
`INDEX.md` shows the new approval dates.

## What to watch in the pilot (11 Jan to 29 Jan)

- Questions it couldn't answer: each "That isn't in the Brain yet" should become an Inbox
  submission (the bot gives the link). Count them weekly.
- Wrong or outdated answers: staff use the same link to log a correction.
- Whether people use it from mobile, desktop or web, and whether the offshore team can get seats.

These feed the monthly quality report and the Phase 2 decision (a custom bot in Teams/Slack or the
HubSpot help desk sidebar).
