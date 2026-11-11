## Seed: Heaters & Controls (14 products, 33 cards)

Draft cards created from **Revel Product Spec Sheets.xlsx** (received 2026-11-11) by `scripts/import_spec_sheet.py`. Facts are copied as written on the sheet. Prices are left out on purpose: Shopify stays the source of truth for price.

Every card is `status: In review`. When both approvers sign off and this merges, the stamp workflow sets them Live with the approval date.

### Products

| Product | SKUs | Cards |
|---|---|---|
| 10kg Harvia Olivine Diabase Sauna Stones | 1 |  |
| 20kg Harvia Vulcanite Sauna Stones | 1 | specs |
| Harvia Electronic Black Cilindro Heater | 1 | specs, electrical |
| Harvia Electronic Black Wall Heater 4.5kW - SW45E | 1 | specs, electrical |
| Harvia Electronic Black Wall Heater 6kW - SW60E | 1 | specs, electrical, warranty |
| Harvia Electronic Black Wall Heater 9kW - SW90E | 1 | specs, electrical, warranty |
| Harvia Electronic Silver Cilindro Heater | 1 | specs, electrical |
| Harvia Electronic Vega Compact Heater 3.5kW | 1 | specs, electrical, warranty |
| Harvia Manual Black Wall Heater 4.5kW - SW45 | 1 | specs, electrical, warranty |
| Harvia Manual Black Wall Heater 6kW - SW60 | 1 | specs, electrical |
| Harvia Manual Black Wall Heater 9KW - SW90 | 1 | specs, electrical, warranty |
| Harvia Manual Vega Heater 3.5kW | 1 | specs, electrical, warranty |
| Harvia Xenio Heater Control Kits - Non Wifi | 2 | specs, electrical, warranty |
| Harvia Xenio Heater Control Kits - Wifi | 2 | specs, electrical, warranty |

### What needs your attention

**Conflict: sources disagree or a value looks wrong**

- [ ] **Harvia Manual Black Wall Heater 4.5kW - SW45 (row 52)** · specs: Listed twice on the spec sheet (rows 51 and 52, SKUs `s-017` / `R-H-SW45KW`) and they differ: Max Temp `85°C` vs `80°C`; Stones `20g` vs `(blank)`; Dimensions (cm) `(blank)` vs `61(H) x 38 (W) x 26 (D)`; Net Weight `(blank)` vs `10.1 kg`. Cards use row 52; confirm which is right and retire the other SKU.
- [ ] **Harvia Electronic Black Wall Heater 4.5kW - SW45E (row 46)** · warranty: The warranty column holds dimensions, not warranty terms. Warranty card not created; terms needed.

**Check: needs a decision before it goes live**

- [ ] **Harvia Electronic Black Wall Heater 6kW - SW60E (row 47), Harvia Electronic Black Wall Heater 9kW - SW90E (row 48)** · install: Manual link is `Electric_heater_Harvia_SW45_f0f86663-7888-42e1-86c8-b50a0be46fc4.pdf`, which names SW45, not this product. Confirm the right manual.
- [ ] **Harvia Manual Vega Heater 3.5kW (row 55)** · install: Manual link is `Harvia_BC_Compact_Manual.pdf`, which names Compact, not this product. Confirm the right manual.
- [ ] **10kg Harvia Olivine Diabase Sauna Stones (row 43)** · specs: SKU `S-030` doesn't follow the `R-` format. Confirm it is current.
- [ ] **Harvia Electronic Black Wall Heater 9kW - SW90E (row 48)** · electrical: `37.5 Amp (hardwired dedicated circuit)`: 37.5 A is the heater's load at 240 V, not a standard circuit or breaker size. Confirm the circuit rating to quote customers.
- [ ] **Harvia Manual Black Wall Heater 9KW - SW90 (row 54)** · specs: SKU `s-019` doesn't follow the `R-` format. Confirm it is current.
- [ ] **Harvia Manual Black Wall Heater 9KW - SW90 (row 54)** · electrical: `37.5 Amp (dedicated circuit)`: 37.5 A is the heater's load at 240 V, not a standard circuit or breaker size. Confirm the circuit rating to quote customers.

**Gap: missing on the spec sheet**

- [ ] **10kg Harvia Olivine Diabase Sauna Stones (row 43), 20kg Harvia Vulcanite Sauna Stones (row 44), Harvia Electronic Black Cilindro Heater (row 45), Harvia Electronic Silver Cilindro Heater (row 49), Harvia Manual Black Wall Heater 6kW - SW60 (row 53)** · warranty: No warranty terms on the spec sheet.
- [ ] **10kg Harvia Olivine Diabase Sauna Stones (row 43), 20kg Harvia Vulcanite Sauna Stones (row 44), Harvia Manual Black Wall Heater 4.5kW - SW45 (row 52), Harvia Manual Black Wall Heater 6kW - SW60 (row 53), Harvia Manual Black Wall Heater 9KW - SW90 (row 54), Harvia Xenio Heater Control Kits - Non Wifi (row 56)** · install: No product manual linked.
- [ ] **10kg Harvia Olivine Diabase Sauna Stones (row 43)** · specs: No specs on the spec sheet.

### Approver checklist

**Tristan Krutz**
- [ ] Technical accuracy against the source
- [ ] Matches current factory spec and SKU

**Ben Coleman**
- [ ] Technical accuracy against the source
- [ ] Brand voice, claims and compliance wording
- [ ] Fit for customer-facing use (FAQ cards)
