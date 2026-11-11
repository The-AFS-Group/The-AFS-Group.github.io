## Seed: Sauna Hybrid (2 products, 8 cards)

Draft cards created from **Revel Product Spec Sheets.xlsx** (received 2026-11-11) by `scripts/import_spec_sheet.py`. Facts are copied as written on the sheet. Prices are left out on purpose: Shopify stays the source of truth for price.

Every card is `status: In review`. When both approvers sign off and this merges, the stamp workflow sets them Live with the approval date.

### Products

| Product | SKUs | Cards |
|---|---|---|
| Revel NordicWave Infrared & Traditional Hybrid Sauna - Next Gen | 3 | specs, electrical, install, care, warranty |
| Revel Outdoor NordicWave 3 Person Infrared & Traditional Hybrid Sauna | 6 | specs, electrical, warranty |

**Merge order:** these cards link to cards in the Heaters & Controls seed PR. Merge that one first so the links work.

### What needs your attention

**Fixed on import (typos only)**

- dimensions: double space in '(lower bench)': NordicWave (Next Gen) (row 28), Outdoor NordicWave 3P (row 29)
- warranty: 'Componetry' -> 'Componentry': Outdoor NordicWave 3P (row 29)

### Approver checklist

**Tristan Krutz**
- [ ] Technical accuracy against the source
- [ ] Matches current factory spec and SKU

**Ben Coleman**
- [ ] Technical accuracy against the source
- [ ] Brand voice, claims and compliance wording
- [ ] Fit for customer-facing use (FAQ cards)
