# Warehouse planner pipeline

Feeds the **Warehouse Planner** tab on the GAF master dashboard: inbound containers and large
dispatches for the AFS-Gold Coast warehouse, by day, week and the coming weeks.

```
NetSuite REST query service (SuiteQL, read-only integration role)
  -> build.py (nightly GitHub Action, 2:13am AEST) -> warehouse-planner.json
  -> gaf-master-dashboard/ -> Warehouse Planner tab
```

No saved searches or Google Sheets are involved. The job runs three SuiteQL queries directly,
signed with a token-based authentication (TBA) token for a read-only role.

## Status

Until the five NetSuite secrets exist, the nightly workflow skips cleanly and the tab shows the
one-off example snapshot from 21 Oct 2026 (built from `sample/`).

## Privacy and logs

- This site is public. Orders are published by **sales order number and customer type only**.
  `build.py` copies whitelisted fields, so no customer name, email or phone can reach the output.
  Do not add personal fields.
- This repo is public, so its Actions logs are public. `build.py` prints only row counts and
  HTTP status codes. Never add a print of record contents.

## One-time setup

You need NetSuite Administrator access, and admin access to this GitHub repo.

### In NetSuite

1. **Turn on the features.** Setup > Company > Enable Features > SuiteCloud tab.
   Tick **REST Web Services** (SuiteTalk section) and **Token-Based Authentication**
   (Manage Authentication section). Accept the terms and Save. Skip any that are already ticked.

2. **Create the read-only role.** Setup > Users/Roles > Manage Roles > New.
   - Name: `Warehouse Planner Integration (read-only)`
   - Tick **Web Services Only Role**.
   - Subsidiary restrictions: Australian Fitness Supplies.
   - Permissions, all at level **View** unless stated:

     | Subtab | Permission | Level |
     |---|---|---|
     | Transactions | Purchase Order | View |
     | Transactions | Sales Order | View |
     | Transactions | Find Transaction | View |
     | Lists | Items | View |
     | Lists | Vendors | View |
     | Lists | Locations | View |
     | Reports | SuiteAnalytics Workbook | View |
     | Setup | Log in using Access Tokens | Full |
     | Setup | REST Web Services | Full |
     | Custom Record | AVT CM Container | View |

   - Save. Do not add Customers. The job reads customer type from the sales order itself.

3. **Create the integration record.** Setup > Integration > Manage Integrations > New.
   - Name: `GAF Warehouse Planner`. State: Enabled.
   - Authentication: tick **Token-Based Authentication** only. Untick TBA: Authorization Flow,
     Authorization Code Grant, Client Credentials and User Credentials.
   - Save. The page then shows **Consumer Key** and **Consumer Secret** once. Copy both now.

4. **Create the integration user.** Lists > Employees > Employees > New.
   - Name: `Warehouse Planner Integration`. Use a shared mailbox for the email, not a person's.
   - Subsidiary: Australian Fitness Supplies.
   - Access tab: tick **Give Access**, set any strong password, and add the role from step 2.
   - Save. This usually uses one NetSuite user licence. If none is spare, you can add the role to
     an existing employee instead, but the token then stops working if that person leaves or
     loses access.

5. **Create the access token.** Setup > Users/Roles > Access Tokens > New.
   - Application Name: `GAF Warehouse Planner`. User: `Warehouse Planner Integration`.
     Role: `Warehouse Planner Integration (read-only)`.
   - Save. The page then shows **Token ID** and **Token Secret** once. Copy both now.

6. **Note the account ID.** Setup > Company > Company Information > Account ID, for example
   `1234567`. A sandbox looks like `1234567_SB1`. Enter it exactly as shown.

### In GitHub

7. Repo **Settings > Secrets and variables > Actions > New repository secret**. Add five:

   | Secret | Value |
   |---|---|
   | `NS_ACCOUNT_ID` | Account ID from step 6 |
   | `NS_CONSUMER_KEY` | Consumer Key from step 3 |
   | `NS_CONSUMER_SECRET` | Consumer Secret from step 3 |
   | `NS_TOKEN_ID` | Token ID from step 5 |
   | `NS_TOKEN_SECRET` | Token Secret from step 5 |

8. **Test it.** Actions tab > **Warehouse planner** > Run workflow. A good run logs three row
   counts and "Wrote warehouse-planner.json". The tab's top strip then changes from
   "Example snapshot" to "Nightly extract". After that it runs every night by itself.

## Troubleshooting

| Log says | Fix |
|---|---|
| HTTP 401 | A secret is wrong or has a stray space, or the token, user, role or integration record is disabled. |
| HTTP 403, or a "not found" record type | Add the missing permission to the role (step 2). |
| Container data or brand comes back blank | Open that custom field (Customization > Lists, Records & Fields) and check its Access tab doesn't hide it from the role. |
| Skipped, secrets not configured | One of the five secrets is missing or misnamed. |

To revoke access at any time, open Setup > Users/Roles > Access Tokens and set the token to
Inactive. Create a new token and update the two token secrets to rotate it.

## What the job reads

| Query | Filters |
|---|---|
| On-the-water PO lines | PO status Pending Receipt, Partially Received or Pending Billing/Partially Received; header **Shipment on the water** ticked; Gold Coast line locations; item lines with unreceived quantity. The ETA is the line **Expected Receipt Date**. |
| Open sales order lines | SO status Pending Fulfillment, Partially Fulfilled or Pending Billing/Partially Fulfilled; Gold Coast line locations; open quantity. Summed per order, kept at 2 m³ or more. Dated by the header **Expected Ship Date** (`custbodycustbodyorder_edc`). Customer type from `custbodytransactioncustomertype`. |
| AVT CM Container records | Gold Coast locations, created in the last year, for container sizes. |

The "on the water" box is never unticked after receipt, so the unreceived-quantity filter is
what keeps received POs out. The exact SuiteQL is at the top of `build.py`.

## Rules applied by build.py

- A line split across containers is shared out by its quantity in each container.
- A container's date is the line ETA that covers most of its volume; mixed ETAs are flagged.
- A container or PO with an ETA before today, not yet received, is flagged overdue.
- A header Order ETA more than 3 days from the line ETA is listed as out of date.
- Lines with no container number appear as "Booked, not loaded yet", grouped by PO.
- Orders under 2 m³ are dropped. Orders with no Expected Ship Date appear in their own tray.

## Run it locally

```
python build.py --inputs sample --today 2026-10-21 --snapshot   # rebuild the example snapshot offline
NS_ACCOUNT_ID=... NS_CONSUMER_KEY=... NS_CONSUMER_SECRET=... NS_TOKEN_ID=... NS_TOKEN_SECRET=... python build.py
```
