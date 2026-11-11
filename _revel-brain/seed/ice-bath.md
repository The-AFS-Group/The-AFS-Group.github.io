## Seed: Ice Bath (11 products, 29 cards)

Draft cards created from **Revel Product Spec Sheets.xlsx** (received 2026-11-11) by `scripts/import_spec_sheet.py`. Facts are copied as written on the sheet. Prices are left out on purpose: Shopify stays the source of truth for price.

Every card is `status: In review`. When both approvers sign off and this merges, the stamp workflow sets them Live with the approval date.

### Products

| Product | SKUs | Cards |
|---|---|---|
| Revel Commercial Chiller - 2.0HP | 1 | specs, electrical, warranty |
| Revel Edur - Noir Ice Bath Includes Chiller | 1 | specs, electrical, warranty |
| Revel Edur Noir Ice Bath Tub - Acrylic Ice Bath | 3 | specs, electrical, warranty |
| Revel Freeze - Mobile Ice Bath | 4 | specs |
| Revel Glacier Duo – Premium Cedar Ice Bath V3 | 3 | specs, warranty |
| Revel Glacier Solo – Premium Cedar Ice Bath V3 | 3 | specs, warranty |
| Revel Glasur All in One Ice Bath | 1 | specs, electrical, warranty |
| Revel Glasur X All in One Ice Bath | 1 | specs, electrical, warranty |
| Revel Ice Bath Chiller - Medium 1.0HP | 1 | specs, electrical, warranty |
| Revel Ice Bath Chiller - Mini 0.5HP | 1 | specs, electrical, warranty |
| Revel Zero - Ice Making Chiller - 1.0HP | 1 | specs, electrical, warranty |

### What needs your attention

**Conflict: sources disagree or a value looks wrong**

- [ ] **Zero - Ice Making Chiller 1.0HP (row 42)** · electrical: Power 2450 (the sheet gives no unit) is more than a 10 A outlet supplies (2,400 W at 240 V). Confirm the power figure and the outlet needed.

**Check: needs a decision before it goes live**

- [ ] **Freeze - Mobile Ice Bath (row 34)** · specs: SKU `R-ICEMOB-CHILLERMOB`: Mobile chiller (`CHILLERMOB`): no chiller with this code on the spec sheet.

**Claims and compliance wording (Ben)**

- [ ] **Edur - Noir Ice Bath Includes Chiller (row 32)** · electrical: Running-cost claim (`Cost p/h`). Confirm the tariff it assumes before it goes live.

**Gap: missing on the spec sheet**

- [ ] **Freeze - Mobile Ice Bath (row 34)** · warranty: No warranty terms on the spec sheet.
- [ ] **Ice Bath Chiller - Mini 0.5HP (row 41)** · install: No product manual linked.

### Approver checklist

**Tristan Krutz**
- [ ] Technical accuracy against the source
- [ ] Matches current factory spec and SKU

**Ben Coleman**
- [ ] Technical accuracy against the source
- [ ] Brand voice, claims and compliance wording
- [ ] Fit for customer-facing use (FAQ cards)
