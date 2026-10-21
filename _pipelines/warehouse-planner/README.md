# Warehouse planner pipeline

Feeds the **Warehouse Planner** tab on the GAF master dashboard: inbound containers and large
dispatches for the AFS-Gold Coast warehouse, by day, week and the coming weeks.

```
NetSuite saved searches (3) -> published Google Sheet CSVs -> build.py (nightly Action)
  -> warehouse-planner.json -> gaf-master-dashboard/ -> Warehouse Planner tab
```

There is no NetSuite or Google credential in this repo. The same pattern runs the HGB and
dead stock trackers.

## Status

The tab currently shows a **one-off example snapshot** (21 Oct 2026), built from the CSVs in
`sample/`. The nightly workflow (`.github/workflows/warehouse-planner.yml`) skips cleanly until
the three feed URLs below exist as repo Actions secrets.

## Privacy rule

This site is public. Orders are published by **sales order number and customer type only**.
`build.py` copies whitelisted fields, so a customer name, email or phone column in a feed can
never reach the output. Do not add personal fields to `build.py`.

## Feeds

Each feed is a NetSuite saved search exported to a Google Sheet tab, published as CSV. Column
headers must match the names below. Extra columns are ignored.

### 1. `WP_INBOUND_URL`: open on-the-water PO lines

Purchase orders with status Pending Receipt, Partially Received or Pending Billing/Partially
Received, header box **Shipment on the water** ticked, line location AFS-Gold Coast or
AFS-GOLDCOAST-REBEL, item lines only, quantity minus quantity received above zero.

| Column | NetSuite field |
|---|---|
| `po` | PO number |
| `supplier` | Vendor name |
| `sku` | Item |
| `brand` | Item: Brand (`custitemitem_brand`) |
| `open_qty` | Quantity minus quantity received |
| `cbm` | Open qty × item Cubic Volume (`custitem_item_cubic_volume`) |
| `cartons` | Open qty × item Number of cartons (`custitem_num_of_cartons`, default 1) |
| `eta` | Line **Expected Receipt Date**. This is the agreed ETA. |
| `header_eta` | Header Order ETA (`custbodyorder_eta`), used only to flag stale headers |
| `container_data` | Line AVT CM Container Data (`custcol_avt_cng_container_data`), e.g. `TGBU7942047(56)\|ZCSU6685381(20)` |

The "on the water" box is never unticked after receipt, so the unreceived-quantity filter is
what keeps received POs out.

### 2. `WP_ORDERS_URL`: large Gold Coast dispatches

Open sales orders (Pending Fulfillment, Partially Fulfilled, Pending Billing/Partially
Fulfilled), open lines at the Gold Coast locations, grouped by order, kept when the open volume
is 2 m³ or more.

| Column | NetSuite field |
|---|---|
| `so` | Sales order number |
| `customer_type` | Header Customer Type (`custbodytransactioncustomertype`), falling back to the customer record's Customer Type |
| `ship` | Header **Expected Ship Date** (`custbodycustbodyorder_edc`, shown on the form as Expected Ship Date) |
| `lines` | Count of open lines |
| `cbm` | Sum of open qty × item Cubic Volume |
| `cartons` | Sum of open qty × item Number of cartons |

### 3. `WP_CONTAINERS_URL`: container sizes

AVT CM Container records (`customrecord_avt_cng_container`) for the Gold Coast locations.

| Column | NetSuite field |
|---|---|
| `container` | Name (the container number) |
| `size` | Container Sizes (`custrecord_avt_cng_cnt_size`), e.g. "40 Ft. Container" |

## Rules applied by build.py

- A line split across containers is shared out by its quantity in each container.
- A container's date is the line ETA that covers most of its volume; mixed ETAs are flagged.
- A container or PO with an ETA before today, not yet received, is flagged overdue.
- A header Order ETA more than 3 days from the line ETA is listed as out of date.
- Lines with no container number appear as "Booked, not loaded yet", grouped by PO.
- Orders under 2 m³ are dropped. Orders with no Expected Ship Date appear in their own tray.

## Run it locally

```
python build.py --inputs sample --today 2026-10-21 --snapshot   # rebuild the example snapshot
WP_INBOUND_URL=... WP_ORDERS_URL=... WP_CONTAINERS_URL=... python build.py
```

Output: `warehouse-planner.json` in this folder. The workflow copies it to
`gaf-master-dashboard/` and `_src/gaf-master-dashboard/public/`.
