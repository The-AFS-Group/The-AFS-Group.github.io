## Seed: Sauna Traditional (15 products, 52 cards)

Draft cards created from **Revel Product Spec Sheets.xlsx** (received 2026-11-11) by `scripts/import_spec_sheet.py`. Facts are copied as written on the sheet. Prices are left out on purpose: Shopify stays the source of truth for price.

Every card is `status: In review`. When both approvers sign off and this merges, the stamp workflow sets them Live with the approval date.

### Products

| Product | SKUs | Cards |
|---|---|---|
| Revel Aurora - 2 Person Traditional Cedar Barrel Sauna - Next Gen | 5 | specs, electrical, care, warranty |
| Revel Eden - 4 Person Traditional Barrel Sauna | 4 | specs, electrical, care, warranty |
| Revel Eden - 8 Person Traditional Barrel Sauna | 2 | specs, electrical, care, warranty |
| Revel Edenview - 4 Person Traditional Cedar Barrel Sauna | 4 | specs, electrical, care, warranty |
| Revel Kuusi 2 Person Traditional Finnish Sauna | 5 | specs, electrical, warranty |
| Revel Kuusi 4 Person Traditional Finnish Sauna | 4 | specs, electrical, warranty |
| Revel Loom 2 Person Traditional Finnish Sauna - Next Gen | 2 | specs, electrical, warranty |
| Revel Loom 4 Person Traditional Finnish Sauna - Next Gen | 7 | specs, electrical, warranty |
| Revel Solaris 3-4 Person Traditional Cabin | 6 | specs, electrical, care, warranty |
| Revel Tampere 2 Person Traditional Finnish Sauna - Next Gen | 5 | specs, electrical, warranty |
| Revel Tampere 4 Person Traditional Finnish Sauna - Next Gen | 6 | specs, electrical, warranty |
| Revel Tampere Grand Traditional Finnish Sauna | 1 | specs, electrical, warranty |
| Revel Tampere Plus Traditional Finnish Sauna | 1 | specs, electrical, warranty |
| Revel Virta 2 Person Traditional Cabin | 4 | specs, electrical, care, warranty |
| Revel Virta 4 Person Traditional Cabin | 7 | specs, electrical, care, warranty |

**Merge order:** these cards link to cards in the Heaters & Controls seed PR. Merge that one first so the links work.

### What needs your attention

**Conflict: sources disagree or a value looks wrong**

- [ ] **Tampere Plus (row 10)** · electrical: Says `Heater: Harvia Wall 9kw` but power is 6,000 W and the SKU is `R-TR-C6P-H-SW60KW-E`.

**Check: needs a decision before it goes live**

- [ ] **Tampere Plus (row 10)** · install: Manual link is `Revel_Tampere_Grand_Sauna_Manual_A4_1026a.pdf`, which names Grand, not this product. Confirm the right manual.
- [ ] **Loom 4P (Next Gen) (row 5)** · electrical: SKU `R-TR-PREM-4P-S-019-XENIO-WIFI-CX170` pairs a manual heater with a Xenio controller (a retrofit, per the Xenio card). Confirm this variant ships the manual heater and not the electronic (E) model.
- [ ] **Solaris 3-4P (row 6)** · electrical: SKU `R-TR-CAB-3P-V2-S-019-WIFI-XENIO` pairs a manual heater with a Xenio controller (a retrofit, per the Xenio card). Confirm this variant ships the manual heater and not the electronic (E) model.
- [ ] **Tampere 4P (Next Gen) (row 8)** · electrical: SKU `R-TR-4P-V3-S-019-XENIO-WIFI-CX170` pairs a manual heater with a Xenio controller (a retrofit, per the Xenio card). Confirm this variant ships the manual heater and not the electronic (E) model.
- [ ] **Virta 4P (row 12)** · electrical: SKU `R-TR-VIRTA-4P-S-019-XENIO-WIFI-CX170` pairs a manual heater with a Xenio controller (a retrofit, per the Xenio card). Confirm this variant ships the manual heater and not the electronic (E) model.
- [ ] **Tampere Grand (row 9)** · electrical: `37.5 Amp (dedicated circuit)`: 37.5 A is the heater's load at 240 V, not a standard circuit or breaker size. Confirm the circuit rating to quote customers.

**Fixed on import (typos only)**

- warranty: 'Componetry' -> 'Componentry': Kuusi 2P (row 2), Kuusi 4P (row 3), Tampere 4P (Next Gen) (row 8)
- dimensions: double space in '(lower bench)': Loom 2P (Next Gen) (row 4), Loom 4P (Next Gen) (row 5), Tampere 2P (Next Gen) (row 7), Tampere 4P (Next Gen) (row 8)
- dimensions: '200W)' -> '200(W)': Loom 4P (Next Gen) (row 5)
- general: space after 'Temperature:': Virta 2P (row 11), Virta 4P (row 12), Eden 8P (row 15), Edenview 4P (row 16)

### Approver checklist

**Tristan Krutz**
- [ ] Technical accuracy against the source
- [ ] Matches current factory spec and SKU

**Ben Coleman**
- [ ] Technical accuracy against the source
- [ ] Brand voice, claims and compliance wording
- [ ] Fit for customer-facing use (FAQ cards)
