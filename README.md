# Swirl & Dry Sari-Sari POS

Tablet-ready sari-sari store POS for Cloudflare Workers and D1.

## Included

- Touchscreen cashier and barcode search
- Retail and wholesale pricing
- Cash, GCash, Maya and bank transfer payments
- Inventory, stock-in, low-stock and expiry monitoring
- Customers and utang tracking
- Supplier credit and due dates
- Sales, expenses and reports
- Staff payroll and store-credit deductions
- End-shift bill and coin counter
- Cloudflare D1 persistence

## Cloudflare setup

1. Create a D1 database named `swirl-dry-sari-sari-pos-db`.
2. Copy its database ID into `wrangler.jsonc`, replacing the placeholder ID.
3. Apply the migration in `drizzle/0000_large_doorman.sql`.
4. In Cloudflare Workers Builds, use `npm run deploy` as the deploy command.

The Worker name must remain `swirl-dry-sari-sari-pos` so it matches the Cloudflare application name.
