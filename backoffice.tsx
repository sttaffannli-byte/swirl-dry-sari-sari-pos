"use client";

import { useEffect, useMemo, useState } from "react";

export type ProductRecord = { id: number; barcode: string; name: string; category: string; cost: number; retailPrice: number; wholesalePrice: number; stock: number; minStock: number; expiryDate?: string | null; icon: string; color: string };
export type SaleRecord = { id: number; receiptNo: string; customerName: string; paymentMethod: string; subtotal: number; discount: number; total: number; itemCount: number; cashier: string; status: string; createdAt: string };
export type ExpenseRecord = { id: number; category: string; description: string; amount: number; paymentMethod: string; createdAt: string };
export type SupplierRecord = { id: number; name: string; contactNo: string; totalCredit: number; amountPaid: number; dueDate?: string | null };
export type CustomerRecord = { id: number; name: string; contactNo: string; creditLimit: number; balance: number };
export type EmployeeRecord = { id: number; fullName: string; role: string; dailyRate: number; workDays: number; storeCredit: number; status: string };
export type HeldOrderRecord = { id: number; label: string; customerId?: number | null; priceMode: string; discount: number; cartJson: string; createdAt: string };
export type StoreSettingsRecord = { id: number; businessName: string; address: string; receiptFooter: string; autoPrint: boolean; soundEnabled: boolean; lowStockAlerts: boolean };
export type TransactionRecord = { id: number; customerId?: number; supplierId?: number; type: string; amount: number; paymentMethod?: string; referenceNo?: string | null; notes?: string; createdAt: string };
export type StockMovementRecord = { id: number; productId: number; type: string; quantity: number; referenceNo?: string | null; notes?: string; createdAt: string };
export type PosData = {
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  suppliers: SupplierRecord[];
  customers: CustomerRecord[];
  employees: EmployeeRecord[];
  heldOrders: HeldOrderRecord[];
  customerTransactions: TransactionRecord[];
  supplierTransactions: TransactionRecord[];
  stockMovements: StockMovementRecord[];
  settings?: StoreSettingsRecord;
  range: { from: string; to: string };
};

type EditableRecord = ProductRecord | SupplierRecord | CustomerRecord | EmployeeRecord | null;
type Props = {
  view: string;
  products: ProductRecord[];
  data: PosData;
  online: boolean;
  onAction: (action: string, data: Record<string, unknown>) => Promise<boolean>;
  onRangeChange: (from: string, to: string) => void;
  onReprintSale: (saleId: number) => Promise<void>;
};

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value || 0);
const dateText = (value?: string | null) => {
  if (!value) return "—";
  const normalized = value.length === 10 ? `${value}T00:00:00+08:00` : value.includes("T") ? value : `${value.replace(" ", "T")}+08:00`;
  return new Date(normalized).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", ...(value.length === 10 ? {} : { hour: "numeric", minute: "2-digit" }) });
};
const todayText = () => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const invoiceNumber = (sale: Pick<SaleRecord, "id" | "createdAt">) => `INV-${(sale.createdAt || todayText()).slice(0, 10).replaceAll("-", "")}-${String(sale.id).padStart(6, "0")}`;

export default function Backoffice({ view, products, data, online, onAction, onRangeChange, onReprintSale }: Props) {
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<EditableRecord>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("All Payments");
  const [from, setFrom] = useState(data.range.from || todayText());
  const [to, setTo] = useState(data.range.to || todayText());
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => onRangeChange(from, to < from ? from : to), 300);
    return () => window.clearTimeout(timer);
  }, [from, to, onRangeChange]);

  function openModal(type: string, record: EditableRecord = null) {
    setSelected(record);
    setModal(type);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    form.forEach((value, key) => { values[key] = value; });
    const ok = await onAction(action, values);
    setSaving(false);
    if (ok) {
      setModal(null);
      setSelected(null);
      setToast("Saved successfully");
      window.setTimeout(() => setToast(""), 2500);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => products.filter((p) => `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(normalizedQuery)), [products, normalizedQuery]);
  const completedSales = useMemo(() => data.sales.filter((sale) => sale.status !== "Voided"), [data.sales]);
  const filteredSales = useMemo(() => data.sales.filter((sale) => {
    const matchesText = `${invoiceNumber(sale)} ${sale.receiptNo} ${sale.customerName} ${sale.cashier}`.toLowerCase().includes(normalizedQuery);
    const matchesPayment = paymentFilter === "All Payments" || sale.paymentMethod === paymentFilter;
    return matchesText && matchesPayment;
  }), [data.sales, normalizedQuery, paymentFilter]);
  const filteredCustomers = data.customers.filter((row) => `${row.name} ${row.contactNo}`.toLowerCase().includes(normalizedQuery));
  const filteredSuppliers = data.suppliers.filter((row) => `${row.name} ${row.contactNo}`.toLowerCase().includes(normalizedQuery));
  const filteredExpenses = data.expenses.filter((row) => `${row.category} ${row.description} ${row.paymentMethod}`.toLowerCase().includes(normalizedQuery));
  const totalSales = completedSales.reduce((sum, row) => sum + row.total, 0);
  const totalExpenses = data.expenses.reduce((sum, row) => sum + row.amount, 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  const inventoryValue = products.reduce((sum, p) => sum + p.cost * p.stock, 0);
  const customerCredit = data.customers.reduce((sum, row) => sum + row.balance, 0);
  const supplierBalance = data.suppliers.reduce((sum, row) => sum + Math.max(0, row.totalCredit - row.amountPaid), 0);
  const paymentTotals = ["Cash", "GCash", "Maya", "Bank Transfer", "Utang"].map((method) => ({ method, total: completedSales.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.total, 0) }));

  async function voidSale(sale: SaleRecord) {
    if (!window.confirm(`Void ${sale.receiptNo}? Stock will be returned automatically.`)) return;
    const ok = await onAction("voidSale", { saleId: sale.id });
    if (ok) setToast("Sale voided and stock restored");
  }

  async function archiveProduct(product: ProductRecord) {
    if (!window.confirm(`Archive ${product.name}? Existing sales history will be kept.`)) return;
    const ok = await onAction("archiveProduct", { productId: product.id });
    if (ok) setToast("Product archived; sales history was preserved");
  }

  return (
    <section className="backoffice-panel">
      {toast && <div className="toast">✓ {toast}</div>}
      <div className="module-head">
        <div><span>BACK OFFICE</span><h1>{titleFor(view)}</h1><p>{subtitleFor(view)}</p></div>
        <div className="module-actions">
          {view !== "settings" && <div className="range-filter"><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label></div>}
          {primaryAction(view, () => openModal(view))}
        </div>
      </div>

      {view === "inventory" && <>
        <div className="metric-grid four"><Metric icon="▦" label="Products" value={String(products.length)} note={`${products.reduce((sum, p) => sum + p.stock, 0)} total units`} tone="blue" /><Metric icon="₱" label="Inventory Value" value={peso(inventoryValue)} note="Based on product cost" tone="green" /><Metric icon="!" label="Low Stock" value={String(lowStock.length)} note="Needs restocking" tone="orange" /><Metric icon="⌛" label="Expiring Soon" value={String(products.filter((product) => isExpiring(product.expiryDate)).length)} note="Within 30 days" tone="purple" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search name, barcode or category" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button onClick={() => setQuery("")}>Clear Search</button><button onClick={() => exportCsv("inventory", products)}>⇩ Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Cost</th><th>Retail</th><th>Wholesale</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><div className="product-cell"><span style={{ background: product.color }}>{product.icon}</span><b>{product.name}</b></div></td><td><code>{product.barcode}</code></td><td>{product.category}</td><td>{peso(product.cost)}</td><td><b>{peso(product.retailPrice)}</b></td><td>{peso(product.wholesalePrice)}</td><td><strong>{product.stock}</strong></td><td><Status tone={product.stock <= product.minStock ? "red" : "green"}>{product.stock <= product.minStock ? "Low Stock" : "In Stock"}</Status></td><td><div className="row-actions"><button className="table-button" onClick={() => openModal("stock", product)}>+ Stock</button><button className="table-button neutral" onClick={() => openModal("productEdit", product)}>Edit</button><button className="table-button danger" onClick={() => void archiveProduct(product)}>Archive</button></div></td></tr>)}</tbody></table></div></div>
      </>}

      {view === "sales" && <>
        <div className="metric-grid four"><Metric icon="₱" label="Gross Sales" value={peso(totalSales)} note={`${completedSales.length} completed transactions`} tone="green" /><Metric icon="▤" label="Average Sale" value={peso(completedSales.length ? totalSales / completedSales.length : 0)} note="Per completed transaction" tone="blue" /><Metric icon="↙" label="Discounts" value={peso(completedSales.reduce((sum, row) => sum + row.discount, 0))} note="Total given" tone="orange" /><Metric icon="×" label="Voided" value={String(data.sales.filter((sale) => sale.status === "Voided").length)} note="Stock restored automatically" tone="purple" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search invoice, receipt, customer or cashier" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option>All Payments</option><option>Cash</option><option>GCash</option><option>Maya</option><option>Bank Transfer</option><option>Utang</option></select><button onClick={() => exportCsv("sales", filteredSales.map((sale) => ({ invoiceNo: invoiceNumber(sale), ...sale })))}>⇩ Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Invoice No.</th><th>Receipt</th><th>Date & Time</th><th>Customer</th><th>Items</th><th>Payment</th><th>Cashier</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredSales.length ? filteredSales.map((sale) => <tr key={sale.id}><td><code>{invoiceNumber(sale)}</code></td><td><code>{sale.receiptNo}</code></td><td>{dateText(sale.createdAt)}</td><td>{sale.customerName}</td><td>{sale.itemCount}</td><td><Status tone="blue">{sale.paymentMethod}</Status></td><td>{sale.cashier}</td><td><b>{peso(sale.total)}</b></td><td><Status tone={sale.status === "Voided" ? "red" : "green"}>{sale.status}</Status></td><td><div className="row-actions"><button className="table-button" onClick={() => void onReprintSale(sale.id)}>Reprint</button>{sale.status !== "Voided" && <button className="table-button danger" onClick={() => void voidSale(sale)}>Void</button>}</div></td></tr>) : <EmptyRow columns={10} text="No transactions found for this date range." />}</tbody></table></div></div>
      </>}

      {view === "customers" && <>
        <div className="metric-grid three"><Metric icon="♙" label="Customers" value={String(data.customers.length)} note="Registered suki" tone="blue" /><Metric icon="₱" label="Total Utang" value={peso(customerCredit)} note="Outstanding balance" tone="orange" /><Metric icon="✓" label="Available Credit" value={peso(data.customers.reduce((sum, row) => sum + Math.max(0, row.creditLimit - row.balance), 0))} note="Across all customers" tone="green" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search customer or contact" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button onClick={() => exportCsv("customer-utang", data.customers)}>⇩ Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Credit Limit</th><th>Utang Balance</th><th>Available</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredCustomers.length ? filteredCustomers.map((customer) => <tr key={customer.id}><td><b>{customer.name}</b></td><td>{customer.contactNo || "—"}</td><td>{peso(customer.creditLimit)}</td><td><b className="orange-text">{peso(customer.balance)}</b></td><td>{peso(Math.max(0, customer.creditLimit - customer.balance))}</td><td><Status tone={customer.balance > customer.creditLimit ? "red" : "green"}>{customer.balance > customer.creditLimit ? "Over Limit" : "Good"}</Status></td><td><button className="table-button" disabled={!customer.balance} onClick={() => openModal("customerPayment", customer)}>Record Payment</button></td></tr>) : <EmptyRow columns={7} text="No customers found. Add a suki customer to manage utang." />}</tbody></table></div></div>
      </>}

      {view === "suppliers" && <>
        <div className="metric-grid three"><Metric icon="▣" label="Suppliers" value={String(data.suppliers.length)} note="Active accounts" tone="blue" /><Metric icon="₱" label="Credit Balance" value={peso(supplierBalance)} note="Total payable" tone="orange" /><Metric icon="!" label="Due Soon" value={String(data.suppliers.filter((row) => Math.max(0, row.totalCredit - row.amountPaid) > 0 && dueTone(row.dueDate) !== "green").length)} note="Needs attention" tone="purple" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search supplier or contact" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button onClick={() => exportCsv("supplier-balances", data.suppliers)}>⇩ Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Contact</th><th>Total Credit</th><th>Amount Paid</th><th>Balance</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredSuppliers.length ? filteredSuppliers.map((supplier) => { const balance = Math.max(0, supplier.totalCredit - supplier.amountPaid); const tone = balance ? dueTone(supplier.dueDate) : "green"; return <tr key={supplier.id}><td><b>{supplier.name}</b></td><td>{supplier.contactNo || "—"}</td><td>{peso(supplier.totalCredit)}</td><td>{peso(supplier.amountPaid)}</td><td><b>{peso(balance)}</b></td><td>{dateText(supplier.dueDate)}</td><td><Status tone={tone}>{balance ? dueLabel(supplier.dueDate) : "Paid"}</Status></td><td><div className="row-actions"><button className="table-button neutral" onClick={() => openModal("supplierInvoice", supplier)}>+ Invoice</button><button className="table-button" disabled={!balance} onClick={() => openModal("supplierPayment", supplier)}>Pay</button></div></td></tr>; }) : <EmptyRow columns={8} text="No suppliers found. Add one to track invoices, payments and due dates." />}</tbody></table></div></div>
      </>}

      {view === "expenses" && <>
        <div className="metric-grid three"><Metric icon="↙" label="Total Expenses" value={peso(totalExpenses)} note="Selected period" tone="orange" /><Metric icon="₱" label="Operating Net" value={peso(totalSales - totalExpenses)} note="Sales less recorded expenses" tone="green" /><Metric icon="▤" label="Entries" value={String(data.expenses.length)} note="Recorded expenses" tone="blue" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search category, description or payment" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button onClick={() => exportCsv("expenses", filteredExpenses)}>⇩ Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payment</th><th>Amount</th></tr></thead><tbody>{filteredExpenses.length ? filteredExpenses.map((expense) => <tr key={expense.id}><td>{dateText(expense.createdAt)}</td><td><Status tone="blue">{expense.category}</Status></td><td>{expense.description}</td><td>{expense.paymentMethod}</td><td><b>{peso(expense.amount)}</b></td></tr>) : <EmptyRow columns={5} text="No expenses found for this date range." />}</tbody></table></div></div>
      </>}

      {view === "reports" && <>
        <div className="metric-grid four"><Metric icon="↗" label="Sales" value={peso(totalSales)} note="Completed sales" tone="green" /><Metric icon="↙" label="Expenses" value={peso(totalExpenses)} note="Recorded expenses" tone="orange" /><Metric icon="₱" label="Operating Net" value={peso(totalSales - totalExpenses)} note="Before cost-of-goods adjustment" tone="blue" /><Metric icon="▦" label="Inventory" value={peso(inventoryValue)} note="Current cost value" tone="purple" /></div>
        <div className="report-grid"><div className="data-card chart-card"><div className="card-title"><div><h3>Sales by Day</h3><p>{from} to {to}</p></div></div><SalesBars sales={completedSales} /></div><div className="data-card breakdown"><div className="card-title"><div><h3>Payment Methods</h3><p>Share of collected sales</p></div></div>{paymentTotals.map(({ method, total }, index) => { const percent = totalSales ? Math.round(total / totalSales * 100) : 0; return <div className="break-row" key={method}><span>{method === "Bank Transfer" ? "Bank" : method}</span><div><i className={["green", "blue", "purple", "orange", "red"][index]} style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div>; })}</div></div>
        <div className="report-links"><button onClick={() => exportCsv("daily-sales", completedSales)}><span>▤</span><b>Sales CSV</b><small>Transactions and payment channels</small></button><button onClick={() => exportCsv("inventory", products)}><span>▦</span><b>Inventory CSV</b><small>Stocks, pricing and low items</small></button><button onClick={() => exportCsv("expenses", data.expenses)}><span>₱</span><b>Expenses CSV</b><small>Expense entries for the period</small></button><button onClick={() => exportCsv("supplier-balances", data.suppliers)}><span>▣</span><b>Supplier CSV</b><small>Credits, payments and due dates</small></button></div>
      </>}

      {view === "staff" && <>
        <div className="metric-grid three"><Metric icon="♙" label="Active Staff" value={String(data.employees.filter((row) => row.status === "Active").length)} note="Current employees" tone="blue" /><Metric icon="₱" label="Gross Payroll" value={peso(data.employees.reduce((sum, row) => sum + row.dailyRate * row.workDays, 0))} note="Current pay period" tone="green" /><Metric icon="↙" label="Store Credits" value={peso(data.employees.reduce((sum, row) => sum + row.storeCredit, 0))} note="Salary deductions" tone="orange" /></div>
        <div className="data-card"><div className="data-toolbar"><span className="pay-period">Payroll data is editable per employee.</span><button onClick={() => printPayroll(data.employees)}>▤ Print All Payslips</button></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Role</th><th>Work Days</th><th>Rate / Day</th><th>Gross Salary</th><th>Store Credit</th><th>Net Salary</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.employees.length ? data.employees.map((employee) => <tr key={employee.id}><td><b>{employee.fullName}</b></td><td>{employee.role}</td><td>{employee.workDays}</td><td>{peso(employee.dailyRate)}</td><td>{peso(employee.dailyRate * employee.workDays)}</td><td className="orange-text">−{peso(employee.storeCredit)}</td><td><b className="green-text">{peso(employee.dailyRate * employee.workDays - employee.storeCredit)}</b></td><td><Status tone={employee.status === "Active" ? "green" : "red"}>{employee.status}</Status></td><td><div className="row-actions"><button className="table-button" onClick={() => printPayslip(employee)}>Print</button><button className="table-button neutral" onClick={() => openModal("employeeEdit", employee)}>Edit</button></div></td></tr>) : <EmptyRow columns={9} text="No employees yet." />}</tbody></table></div></div>
      </>}

      {view === "settings" && <Settings online={online} products={products} data={data} onAction={onAction} />}
      {modal && <ActionModal type={modal} record={selected} saving={saving} onClose={() => { setModal(null); setSelected(null); }} onSubmit={submit} />}
    </section>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: string; label: string; value: string; note: string; tone: string }) { return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>; }
function Status({ tone, children }: { tone: string; children: React.ReactNode }) { return <span className={`status ${tone}`}>{children}</span>; }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td colSpan={columns}><div className="empty-table"><span>▤</span><b>{text}</b></div></td></tr>; }

function SalesBars({ sales }: { sales: SaleRecord[] }) {
  const grouped = new Map<string, number>();
  sales.forEach((sale) => { const key = sale.createdAt.slice(0, 10); grouped.set(key, (grouped.get(key) || 0) + sale.total); });
  const rows = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const maximum = Math.max(1, ...rows.map(([, total]) => total));
  if (!rows.length) return <div className="chart-empty"><span>▥</span><b>No completed sales in this range</b></div>;
  return <div className="bar-chart">{rows.map(([day, total]) => <div key={day} title={`${day}: ${peso(total)}`}><span style={{ height: `${Math.max(6, total / maximum * 100)}%` }} /><b>{day.slice(5)}</b></div>)}</div>;
}

function Settings({ online, products, data, onAction }: { online: boolean; products: ProductRecord[]; data: PosData; onAction: Props["onAction"] }) {
  const source = data.settings;
  const [businessName, setBusinessName] = useState(source?.businessName || "SWIRL-DRY AND SARI-SARI STORE");
  const [address, setAddress] = useState(source?.address || "Buting, Pasig City");
  const [footer, setFooter] = useState(source?.receiptFooter || "Maraming salamat po! Please come again.");
  const [receipt, setReceipt] = useState(Boolean(source?.autoPrint));
  const [sound, setSound] = useState(source?.soundEnabled ?? true);
  const [lowStock, setLowStock] = useState(source?.lowStockAlerts ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onAction("updateSettings", { businessName, address, receiptFooter: footer, autoPrint: receipt, soundEnabled: sound, lowStockAlerts: lowStock });
    setSaving(false);
    if (ok) { setSaved(true); window.setTimeout(() => setSaved(false), 2000); }
  }

  function backup() {
    const blob = new Blob([JSON.stringify({ products, ...data, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `swirl-dry-pos-backup-${todayText()}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <><div className="settings-grid"><div className="data-card settings-card"><div className="card-title"><div><h3>Store Information</h3><p>Printed on receipts and reports</p></div></div><label>Business Name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label><label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} /></label><label>Receipt Footer<input value={footer} onChange={(event) => setFooter(event.target.value)} /></label><button className="primary-small" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}</button></div><div className="data-card settings-card"><div className="card-title"><div><h3>Printer & Devices</h3><p>Tablet-compatible setup status</p></div></div><div className="device-row"><span>▤</span><div><b>Receipt Printing</b><small>Uses the tablet browser print dialog</small></div><Status tone="green">Ready</Status></div><div className="device-row"><span>▥</span><div><b>Barcode Scanner</b><small>USB / Bluetooth keyboard-mode scanners</small></div><Status tone="green">Ready</Status></div><div className="device-row"><span>▣</span><div><b>Cash Drawer</b><small>Connect through a compatible receipt printer</small></div><Status tone="blue">Optional</Status></div></div><div className="data-card settings-card"><div className="card-title"><div><h3>POS Preferences</h3><p>Cashier behavior saved to the cloud</p></div></div><Toggle label="Auto-print receipt" checked={receipt} set={setReceipt} /><Toggle label="Button and scan sounds" checked={sound} set={setSound} /><Toggle label="Low-stock warnings" checked={lowStock} set={setLowStock} /><button className="primary-small" disabled={saving} onClick={() => void save()}>Save Preferences</button></div><div className="data-card settings-card"><div className="card-title"><div><h3>Data & Security</h3><p>Business-record protection</p></div></div><div className="backup-status"><span>{online ? "✓" : "!"}</span><div><b>{online ? "Cloud database connected" : "Database connection required"}</b><small>Transactions are kept in Cloudflare D1, not only on this tablet</small></div></div><button className="secondary-wide" onClick={backup}>⇩ Download Complete Backup</button><div className="retention-note">Designed for long-term records: indexed transaction dates, date-range retrieval, and CSV exports keep years of data manageable.</div></div></div></>;
}

function Toggle({ label, checked, set }: { label: string; checked: boolean; set: (value: boolean) => void }) { return <button className="toggle-row" type="button" aria-pressed={checked} onClick={() => set(!checked)}><span>{label}</span><i className={checked ? "on" : ""}><b /></i></button>; }

function ActionModal({ type, record, saving, onClose, onSubmit }: { type: string; record: EditableRecord; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>, action: string) => void }) {
  const product = (type === "stock" || type === "productEdit") ? record as ProductRecord | null : null;
  const supplier = type.startsWith("supplier") ? record as SupplierRecord | null : null;
  const customer = type === "customerPayment" ? record as CustomerRecord | null : null;
  const employee = type === "employeeEdit" ? record as EmployeeRecord | null : null;
  const action = ({ inventory: "createProduct", productEdit: "updateProduct", stock: "stockIn", expenses: "createExpense", suppliers: "createSupplier", supplierInvoice: "addSupplierInvoice", supplierPayment: "recordSupplierPayment", customers: "createCustomer", customerPayment: "recordCustomerPayment", staff: "createEmployee", employeeEdit: "updateEmployee" } as Record<string, string>)[type];
  const titles: Record<string, string> = { inventory: "Add New Product", productEdit: "Edit Product", stock: "Stock In", expenses: "Record Expense", suppliers: "Add Supplier", supplierInvoice: "Add Supplier Invoice", supplierPayment: "Record Supplier Payment", customers: "Add Customer", customerPayment: "Record Utang Payment", staff: "Add Employee", employeeEdit: "Edit Employee" };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={titles[type]}><form className="form-modal" onSubmit={(event) => onSubmit(event, action)}><div className="form-head"><div><small>BACK OFFICE</small><h2>{titles[type]}</h2></div><button type="button" onClick={onClose}>×</button></div>
    {(type === "inventory" || type === "productEdit") && <><input type="hidden" name="productId" value={product?.id || ""} /><div className="form-grid"><label>Product Name<input name="name" required defaultValue={product?.name} placeholder="e.g. Coca-Cola 1.5L" /></label><label>Barcode<input name="barcode" required defaultValue={product?.barcode} placeholder="Scan or enter barcode" /></label><label>Category<select name="category" defaultValue={product?.category || "Beverages"}><option>Beverages</option><option>Groceries</option><option>Snacks</option><option>Household</option><option>Personal Care</option><option>Frozen</option><option>Load</option><option>Others</option></select></label><label>Product Cost<input name="cost" type="number" min="0" step="0.01" defaultValue={product?.cost} required /></label><label>Retail Price<input name="retailPrice" type="number" min="0.01" step="0.01" defaultValue={product?.retailPrice} required /></label><label>Wholesale Price<input name="wholesalePrice" type="number" min="0" step="0.01" defaultValue={product?.wholesalePrice} required /></label>{type === "inventory" && <label>Opening Stock<input name="stock" type="number" min="0" defaultValue="0" required /></label>}<label>Low Stock Alert<input name="minStock" type="number" min="0" defaultValue={product?.minStock ?? 5} required /></label><label>Expiry Date<input name="expiryDate" type="date" defaultValue={product?.expiryDate || ""} /></label></div></>}
    {type === "expenses" && <div className="form-grid"><label>Category<select name="category"><option>Utilities</option><option>Delivery</option><option>Supplies</option><option>Rent</option><option>Salary</option><option>Repairs</option><option>Others</option></select></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="wide">Description<input name="description" required placeholder="What was this expense for?" /></label><label>Payment Method<select name="paymentMethod"><option>Cash</option><option>GCash</option><option>Maya</option><option>Bank Transfer</option></select></label><label>Notes<input name="notes" /></label></div>}
    {type === "suppliers" && <div className="form-grid"><label>Supplier Name<input name="name" required /></label><label>Contact Number<input name="contactNo" inputMode="tel" /></label><label>Opening Credit<input name="totalCredit" type="number" min="0" step="0.01" /></label><label>Amount Already Paid<input name="amountPaid" type="number" min="0" step="0.01" /></label><label>Due Date<input name="dueDate" type="date" /></label><label>Invoice / Reference<input name="referenceNo" /></label><label className="wide">Notes<input name="notes" /></label></div>}
    {type === "supplierInvoice" && <><input type="hidden" name="supplierId" value={supplier?.id || ""} /><div className="record-banner"><b>{supplier?.name}</b><span>Current balance: {peso(Math.max(0, (supplier?.totalCredit || 0) - (supplier?.amountPaid || 0)))}</span></div><div className="form-grid"><label>Invoice Amount<input name="amount" type="number" min="0.01" step="0.01" required autoFocus /></label><label>Invoice Number<input name="referenceNo" required /></label><label>Due Date<input name="dueDate" type="date" /></label><label>Notes<input name="notes" /></label></div></>}
    {type === "supplierPayment" && <><input type="hidden" name="supplierId" value={supplier?.id || ""} /><div className="record-banner"><b>{supplier?.name}</b><span>Balance due: {peso(Math.max(0, (supplier?.totalCredit || 0) - (supplier?.amountPaid || 0)))}</span></div><div className="form-grid"><label>Payment Amount<input name="amount" type="number" min="0.01" max={Math.max(0, (supplier?.totalCredit || 0) - (supplier?.amountPaid || 0))} step="0.01" required autoFocus /></label><label>Reference Number<input name="referenceNo" /></label><label className="wide">Notes<input name="notes" /></label></div></>}
    {type === "customers" && <div className="form-grid"><label>Customer Name<input name="name" required /></label><label>Contact Number<input name="contactNo" inputMode="tel" /></label><label>Credit Limit<input name="creditLimit" type="number" min="0" step="0.01" /></label><label>Opening Utang<input name="balance" type="number" min="0" step="0.01" /></label><label className="wide">Notes<input name="notes" /></label></div>}
    {type === "customerPayment" && <><input type="hidden" name="customerId" value={customer?.id || ""} /><div className="record-banner"><b>{customer?.name}</b><span>Utang balance: {peso(customer?.balance || 0)}</span></div><div className="form-grid"><label>Payment Amount<input name="amount" type="number" min="0.01" max={customer?.balance || 0} step="0.01" required autoFocus /></label><label>Payment Method<select name="paymentMethod"><option>Cash</option><option>GCash</option><option>Maya</option><option>Bank Transfer</option></select></label><label>Reference Number<input name="referenceNo" /></label><label>Notes<input name="notes" /></label></div></>}
    {(type === "staff" || type === "employeeEdit") && <><input type="hidden" name="employeeId" value={employee?.id || ""} /><div className="form-grid"><label>Full Name<input name="fullName" required defaultValue={employee?.fullName} /></label><label>Position<select name="role" defaultValue={employee?.role || "Cashier"}><option>Cashier</option><option>Supervisor</option><option>Stock Clerk</option><option>Payroll Encoder</option><option>Admin</option></select></label><label>Daily Rate<input name="dailyRate" type="number" min="0" step="0.01" defaultValue={employee?.dailyRate || 0} /></label><label>Work Days<input name="workDays" type="number" min="0" step="0.5" defaultValue={employee?.workDays || 0} /></label><label>Store Credit<input name="storeCredit" type="number" min="0" step="0.01" defaultValue={employee?.storeCredit || 0} /></label><label>Status<select name="status" defaultValue={employee?.status || "Active"}><option>Active</option><option>Inactive</option></select></label></div></>}
    {type === "stock" && <><input type="hidden" name="productId" value={product?.id || ""} /><div className="stock-product"><span style={{ background: product?.color }}>{product?.icon}</span><div><b>{product?.name}</b><small>Current stock: {product?.stock}</small></div></div><div className="form-grid"><label>Quantity to Add<input name="quantity" type="number" min="1" required autoFocus /></label><label>Supplier / Reference<input name="referenceNo" /></label><label className="wide">Notes<input name="notes" /></label></div></>}
    <div className="form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save Record"}</button></div></form></div>;
}

function exportCsv(name: string, rows: Array<Record<string, unknown>> | object[]) {
  if (!rows.length) return window.alert("There is no data to export for this selection.");
  const normalized = rows as Array<Record<string, unknown>>;
  const keys = Array.from(new Set(normalized.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [keys.map(escape).join(","), ...normalized.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${name}-${todayText()}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

function payslipHtml(employee: EmployeeRecord) {
  const gross = employee.dailyRate * employee.workDays; const net = gross - employee.storeCredit;
  return `<article><h2>SWIRL & DRY</h2><p>Sari-Sari Store Employee Payslip</p><hr><h3>${employee.fullName}</h3><small>${employee.role}</small><dl><div><dt>Work Days</dt><dd>${employee.workDays}</dd></div><div><dt>Rate / Day</dt><dd>${peso(employee.dailyRate)}</dd></div><div><dt>Gross Salary</dt><dd>${peso(gross)}</dd></div><div><dt>Store Credit</dt><dd>−${peso(employee.storeCredit)}</dd></div><div class="net"><dt>NET SALARY</dt><dd>${peso(net)}</dd></div></dl><footer>Employee Signature: ____________________</footer></article>`;
}
function printDocument(content: string, title: string) {
  const printWindow = window.open("", "_blank", "width=900,height=700"); if (!printWindow) return window.alert("Please allow pop-ups to print.");
  printWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font:14px Arial;margin:24px;color:#173044}.sheet{display:grid;grid-template-columns:1fr 1fr;gap:12px}article{border:1px solid #ccd7dc;border-radius:12px;padding:18px;break-inside:avoid}h2{margin:0;color:#0a7d5b}p,small{color:#667b85}dl div{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e7ecee}.net{font-size:18px;font-weight:bold;color:#087b59}footer{margin-top:28px;font-size:11px}@media print{body{margin:8mm}}</style></head><body><div class="sheet">${content}</div><script>window.onload=()=>{window.print();window.close()}</script></body></html>`); printWindow.document.close();
}
function printPayslip(employee: EmployeeRecord) { printDocument(payslipHtml(employee), `${employee.fullName} Payslip`); }
function printPayroll(employees: EmployeeRecord[]) { if (!employees.length) return window.alert("No employees to print."); printDocument(employees.map(payslipHtml).join(""), "Employee Payslips"); }
function titleFor(view: string) { return ({ inventory: "Inventory Management", sales: "Sales Transactions", customers: "Customers & Utang", suppliers: "Supplier Accounts", expenses: "Expenses", reports: "Business Reports", staff: "Staff & Payroll", settings: "POS Settings" } as Record<string, string>)[view] || "Back Office"; }
function subtitleFor(view: string) { return ({ inventory: "Track products, barcode, pricing, stock and expiry dates.", sales: "Review, filter, export and safely void cashier transactions.", customers: "Manage suki profiles, credit limits, utang and payment history.", suppliers: "Monitor invoices, balances, payments and due dates.", expenses: "Record every business expense for accurate reports.", reports: "Real sales, expenses, inventory and payment performance.", staff: "Manage payroll values and print individual or batch payslips.", settings: "Business details, devices, receipt preferences and backups." } as Record<string, string>)[view] || ""; }
function primaryAction(view: string, open: () => void) { const labels: Record<string, string> = { inventory: "+ Add Product", customers: "+ Add Customer", suppliers: "+ Add Supplier", expenses: "+ Record Expense", staff: "+ Add Employee" }; return labels[view] ? <button className="primary-action" onClick={open}>{labels[view]}</button> : null; }
function dueTone(value?: string | null) { if (!value) return "green"; const days = Math.ceil((new Date(`${value}T23:59:59+08:00`).getTime() - Date.now()) / 86400000); return days < 0 ? "red" : days <= 7 ? "orange" : "green"; }
function dueLabel(value?: string | null) { if (!value) return "No Due Date"; const days = Math.ceil((new Date(`${value}T23:59:59+08:00`).getTime() - Date.now()) / 86400000); return days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `${days} days left`; }
function isExpiring(value?: string | null) { if (!value) return false; const days = Math.ceil((new Date(`${value}T23:59:59+08:00`).getTime() - Date.now()) / 86400000); return days >= 0 && days <= 30; }
