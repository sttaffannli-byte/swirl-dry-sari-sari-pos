# Swirl & Dry Sari-Sari POS

Tablet-ready sari-sari store POS for Cloudflare Workers and D1.

## Included

- Touchscreen cashier and barcode search
- Retail and wholesale pricing
- Cash, GCash, Maya and bank transfer payments
- Customer selection and controlled utang sales
- Quantity barcode format such as `4*4801234567890`
- Hold and recall orders
- Inventory, stock-in, low-stock and expiry monitoring
- Stock movement audit and safe sale voids with automatic stock return
- Customers, credit limits, utang charges and payment history
- Supplier invoices, payments, balances and due dates
- Date-range sales, expenses, reports and CSV exports
- Staff payroll, editable deductions and printable payslips
- End-shift bill and coin counter
- Printable receipts and downloadable receipt QR
- Cloudflare D1 persistence
- Indexed transaction dates for long-term record history

## Cloudflare setup

1. The D1 binding is already set to `swirl-dry-sari-sari-pos-db` with its correct database ID.
2. Upload all files to the existing GitHub repository and replace files with the same names.
3. Cloudflare Workers Builds must use `npm run deploy` as the deploy command.
4. The deploy script automatically applies only unapplied migrations before publishing, so existing data is preserved.

The Worker name must remain `swirl-dry-sari-sari-pos` so it matches the Cloudflare application name.
