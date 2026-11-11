## Seed: compliance certificates and EMF test reports (3 cards)

Shared compliance cards drafted from the documents sent on 11 Nov 2026:

| Card | From |
|---|---|
| `compliance/saa231711-sauna-room.md` | SAA Certificate of Suitability SAA231711 (sauna room, AS/NZS 60335.2.53 + 60335.1, valid to 15 Nov 2028) |
| `compliance/emf-report-a2005111.md` | EMF test report A2005111-C01-R01 (`EMF_TESTING_REPORT_RS.pdf`), EN 62233, May 2020 |
| `compliance/emf-report-t1881542.md` | EMF test report T1881542 02 (`EMF_TESTING_REPORT_SK.pdf`), EN 62233, Oct 2018 |

Facts are copied from the documents. The manufacturers' names and factory model lists are left
out of these customer-facing cards. Send the three PDFs through the Brain Inbox and Claude will
file them under `sources/` with an internal card that maps factory models to Revel products.

### What needs your attention

**Check: needs a decision before it goes live**

- [ ] **All three cards** · compliance: which Revel products does each cover? The documents use factory model numbers, so `applies_to` is empty. Until it's filled in, the chatbot can't say which sauna a certificate belongs to. ("RS" and "SK" in the file names: which ranges are they?)
- [ ] **SAA231711** · compliance: the certificate is rated 3-6 kW. If it covers any cabin sold with a 9 kW heater (SW90 and `s-019` variants of the Loom 4P, Tampere 4P, Solaris, Virta 4P and Tampere Grand), confirm that configuration is covered.
- [ ] **T1881542 02** · compliance: the tested unit drew 1600 W; current infrared saunas draw 1,960-3,020 W. Is this 2018 report still the right evidence for current models, or is there a newer test?

**Claims and compliance wording (Ben)**

- [ ] **Both EMF cards** · customer-ready answer: approve or rewrite. These cards are the evidence behind the "Low EMF" wording on seven infrared saunas and the Helio red light (flagged in those seed PRs).
- [ ] **Both EMF reports** say they "shall not be reproduced in parts without written approval" of the lab. The staff notes say to quote results, not send extracts. OK?

**Report quirks (no action unless the report is shared)**

- A2005111: the "with measurement uncertainty" column is lower than the measured value, the wrong way round. Every reading is about 1.3% of the limit either way.
- T1881542: sensor location reads "Tools, transportable" (template text); the model list repeats one model and lists another twice.

### Approver checklist

**Tristan Krutz**
- [ ] Technical accuracy against the source
- [ ] Matches current factory spec and SKU

**Ben Coleman**
- [ ] Technical accuracy against the source
- [ ] Brand voice, claims and compliance wording
- [ ] Fit for customer-facing use (FAQ cards)
