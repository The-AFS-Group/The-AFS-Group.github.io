## Seed: Bundles (2 products, 2 cards)

Draft cards created from **Revel Product Spec Sheets.xlsx** (received 2026-11-11) by `scripts/import_spec_sheet.py`. Facts are copied as written on the sheet. Prices are left out on purpose: Shopify stays the source of truth for price.

Every card is `status: In review`. When both approvers sign off and this merges, the stamp workflow sets them Live with the approval date.

### Products

| Product | SKUs | Cards |
|---|---|---|
| Revel Aura 3P Infrared Sauna with Glacier Solo Ice Bath and 1HP Chiller | 1 | specs |
| Revel Luna 3P Infrared Cabin Sauna with Glacier Solo Ice Bath and 1HP Chiller | 1 | specs |

**Merge order:** these cards link to cards in the Ice Bath and Sauna Infrared seed PRs. Merge those first so the links work.

### What needs your attention

**Check: needs a decision before it goes live**

- [ ] **Aura 3P Infrared Sauna with Glacier Solo Ice Bath and 1HP Chiller (row 30)** · specs: SKU `R-FS-3P-V2-ICESOLO-V3-TUB-1HP-ICECHILL`: 1HP chiller (`1HP-ICECHILL`): which 1HP chiller? Medium (`CHILLER-XY-10-M`) or Zero (`ICECHILL-SY-10-I`).
- [ ] **Luna 3P with Glacier Solo Ice Bath and 1HP Chiller (row 31)** · specs: SKU `R-BFS-CEDAR-3P-V2-ICESOLO-V3-TUB-1HP-ICECHILL`: 1HP chiller (`1HP-ICECHILL`): which 1HP chiller? Medium (`CHILLER-XY-10-M`) or Zero (`ICECHILL-SY-10-I`).

### Approver checklist

**Tristan Krutz**
- [ ] Technical accuracy against the source
- [ ] Matches current factory spec and SKU

**Ben Coleman**
- [ ] Technical accuracy against the source
- [ ] Brand voice, claims and compliance wording
- [ ] Fit for customer-facing use (FAQ cards)
