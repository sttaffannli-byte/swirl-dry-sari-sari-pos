"use client";

import { useMemo, useState } from "react";

export type ProductRecord = { id: number; barcode: string; name: string; category: string; cost: number; retailPrice: number; wholesalePrice: number; stock: number; minStock: number; expiryDate?: string | null; icon: string; color: string };
export type SaleRecord = { id: number; receiptNo: string; customerName: string; paymentMethod: string; subtotal: number; discount: number; total: number; itemCount: number; cashier: string; createdAt: string };
export type ExpenseRecord = { id: number; category: string; description: string; amount: number; paymentMethod: string; createdAt: string };
export type SupplierRecord = { id: number; name: string; contactNo: string; totalCredit: number; amountPaid: number; dueDate?: string | null };
export type CustomerRecord = { id: number; name: string; contactNo: string; creditLimit: number; balance: number };
export type EmployeeRecord = { id: number; fullName: string; role: string; dailyRate: number; workDays: number; storeCredit: number; status: string };
export type PosData = { sales: SaleRecord[]; expenses: ExpenseRecord[]; suppliers: SupplierRecord[]; customers: CustomerRecord[]; employees: EmployeeRecord[] };

type Props = {
  view: string;
  products: ProductRecord[];
  data: PosData;
  online: boolean;
  onAction: (action: string, data: Record<string, unknown>) => Promise<boolean>;
};

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value || 0);
const dateText = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function Backoffice({ view, products, data, online, onAction }: Props) {
  const [modal, setModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    form.forEach((value, key) => { values[key] = value; });
    const ok = await onAction(action, values);
    setSaving(false);
    if (ok) { setModal(null); setToast("Saved successfully"); window.setTimeout(() => setToast(""), 2500); }
  }

  const filteredProducts = useMemo(() => products.filter((p) => `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const totalSales = data.sales.reduce((sum, row) => sum + row.total, 0);
  const totalExpenses = data.expenses.reduce((sum, row) => sum + row.amount, 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  const inventoryValue = products.reduce((sum, p) => sum + p.cost * p.stock, 0);
  const customerCredit = data.customers.reduce((sum, row) => sum + row.balance, 0);
  const supplierBalance = data.suppliers.reduce((sum, row) => sum + Math.max(0, row.totalCredit - row.amountPaid), 0);

  return (
    <section className="backoffice-panel">
      {toast && <div className="toast">✓ {toast}</div>}
      <div className="module-head">
        <div><span>BACK OFFICE</span><h1>{titleFor(view)}</h1><p>{subtitleFor(view)}</p></div>
        <div className="module-actions"><label className="date-filter"><span>▣</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>{primaryAction(view, () => setModal(view))}</div>
      </div>

      {view === "inventory" && <>
        <div className="metric-grid four"><Metric icon="▦" label="Products" value={String(products.length)} note={`${products.reduce((s, p) => s + p.stock, 0)} total units`} tone="blue" /><Metric icon="₱" label="Inventory Value" value={peso(inventoryValue)} note="Based on product cost" tone="green" /><Metric icon="!" label="Low Stock" value={String(lowStock.length)} note="Needs restocking" tone="orange" /><Metric icon="⌛" label="Expiring Soon" value={String(products.filter(p => p.expiryDate && p.expiryDate <= "2026-09-08").length)} note="Within 30 days" tone="purple" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search name, barcode or category" value={query} onChange={(e) => setQuery(e.target.value)} /></label><select><option>All Categories</option><option>Beverages</option><option>Groceries</option><option>Snacks</option></select><button>▥ Scan Barcode</button></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Cost</th><th>Retail</th><th>Wholesale</th><th>Stock</th><th>Status</th><th /></tr></thead><tbody>{filteredProducts.map((p) => <tr key={p.id}><td><div className="product-cell"><span style={{ background: p.color }}>{p.icon}</span><b>{p.name}</b></div></td><td><code>{p.barcode}</code></td><td>{p.category}</td><td>{peso(p.cost)}</td><td><b>{peso(p.retailPrice)}</b></td><td>{peso(p.wholesalePrice)}</td><td><strong>{p.stock}</strong></td><td><Status tone={p.stock <= p.minStock ? "red" : "green"}>{p.stock <= p.minStock ? "Low Stock" : "In Stock"}</Status></td><td><button className="table-button" onClick={() => { setModal("stock"); sessionStorage.setItem("stockProduct", JSON.stringify(p)); }}>+ Stock</button></td></tr>)}</tbody></table></div></div>
      </>}

      {view === "sales" && <>
        <div className="metric-grid four"><Metric icon="₱" label="Gross Sales" value={peso(totalSales)} note={`${data.sales.length} transactions`} tone="green" /><Metric icon="▤" label="Average Sale" value={peso(data.sales.length ? totalSales / data.sales.length : 0)} note="Per transaction" tone="blue" /><Metric icon="↙" label="Discounts" value={peso(data.sales.reduce((s, r) => s + r.discount, 0))} note="Total given" tone="orange" /><Metric icon="↗" label="Net Sales" value={peso(totalSales)} note="For selected period" tone="purple" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search receipt or customer" /></label><select><option>All Payments</option><option>Cash</option><option>GCash</option><option>Maya</option><option>Bank Transfer</option></select><button onClick={() => window.print()}>▤ Print Report</button></div><div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date & Time</th><th>Customer</th><th>Items</th><th>Payment</th><th>Cashier</th><th>Total</th><th>Status</th></tr></thead><tbody>{data.sales.length ? data.sales.map((r) => <tr key={r.id}><td><code>{r.receiptNo}</code></td><td>{dateText(r.createdAt)}</td><td>{r.customerName}</td><td>{r.itemCount}</td><td><Status tone="blue">{r.paymentMethod}</Status></td><td>{r.cashier}</td><td><b>{peso(r.total)}</b></td><td><Status tone="green">Completed</Status></td></tr>) : <EmptyRow columns={8} text="No sales yet. Completed cashier transactions will appear here." />}</tbody></table></div></div>
      </>}

      {view === "customers" && <>
        <div className="metric-grid three"><Metric icon="♙" label="Customers" value={String(data.customers.length)} note="Registered suki" tone="blue" /><Metric icon="₱" label="Total Utang" value={peso(customerCredit)} note="Outstanding balance" tone="orange" /><Metric icon="✓" label="Available Credit" value={peso(data.customers.reduce((s, r) => s + Math.max(0, r.creditLimit - r.balance), 0))} note="Across all customers" tone="green" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search customer" /></label><button>Payment History</button></div><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Credit Limit</th><th>Utang Balance</th><th>Available</th><th>Status</th><th /></tr></thead><tbody>{data.customers.length ? data.customers.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td>{r.contactNo || "—"}</td><td>{peso(r.creditLimit)}</td><td><b className="orange-text">{peso(r.balance)}</b></td><td>{peso(Math.max(0, r.creditLimit - r.balance))}</td><td><Status tone={r.balance > r.creditLimit ? "red" : "green"}>{r.balance > r.creditLimit ? "Over Limit" : "Good"}</Status></td><td><button className="table-button">Record Payment</button></td></tr>) : <EmptyRow columns={7} text="No customers yet. Add a suki customer to manage store credit." />}</tbody></table></div></div>
      </>}

      {view === "suppliers" && <>
        <div className="metric-grid three"><Metric icon="▣" label="Suppliers" value={String(data.suppliers.length)} note="Active accounts" tone="blue" /><Metric icon="₱" label="Credit Balance" value={peso(supplierBalance)} note="Total payable" tone="orange" /><Metric icon="!" label="Due Soon" value={String(data.suppliers.filter(r => dueTone(r.dueDate) !== "green").length)} note="Needs attention" tone="purple" /></div>
        <div className="data-card"><div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Contact</th><th>Total Credit</th><th>Amount Paid</th><th>Balance</th><th>Due Date</th><th>Status</th><th /></tr></thead><tbody>{data.suppliers.length ? data.suppliers.map((r) => { const balance = Math.max(0, r.totalCredit-r.amountPaid); const tone = dueTone(r.dueDate); return <tr key={r.id}><td><b>{r.name}</b></td><td>{r.contactNo || "—"}</td><td>{peso(r.totalCredit)}</td><td>{peso(r.amountPaid)}</td><td><b>{peso(balance)}</b></td><td>{dateText(r.dueDate)}</td><td><Status tone={tone}>{dueLabel(r.dueDate)}</Status></td><td><button className="table-button">Record Payment</button></td></tr> }) : <EmptyRow columns={8} text="No suppliers yet. Add one to track invoices, credit and due dates." />}</tbody></table></div></div>
      </>}

      {view === "expenses" && <>
        <div className="metric-grid three"><Metric icon="↙" label="Total Expenses" value={peso(totalExpenses)} note="Selected period" tone="orange" /><Metric icon="₱" label="Net Profit" value={peso(totalSales - totalExpenses)} note="Sales less expenses" tone="green" /><Metric icon="▤" label="Entries" value={String(data.expenses.length)} note="Recorded expenses" tone="blue" /></div>
        <div className="data-card"><div className="data-toolbar"><label className="table-search">⌕<input placeholder="Search expense" /></label><select><option>All Categories</option><option>Utilities</option><option>Delivery</option><option>Supplies</option><option>Rent</option></select><button onClick={() => window.print()}>▤ Print</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payment</th><th>Amount</th></tr></thead><tbody>{data.expenses.length ? data.expenses.map((r) => <tr key={r.id}><td>{dateText(r.createdAt)}</td><td><Status tone="blue">{r.category}</Status></td><td>{r.description}</td><td>{r.paymentMethod}</td><td><b>{peso(r.amount)}</b></td></tr>) : <EmptyRow columns={5} text="No expenses recorded for this period." />}</tbody></table></div></div>
      </>}

      {view === "reports" && <>
        <div className="metric-grid four"><Metric icon="↗" label="Sales" value={peso(totalSales)} note="Current records" tone="green" /><Metric icon="↙" label="Expenses" value={peso(totalExpenses)} note="Current records" tone="orange" /><Metric icon="₱" label="Gross Profit" value={peso(totalSales - totalExpenses)} note="Before inventory cost" tone="blue" /><Metric icon="▦" label="Inventory" value={peso(inventoryValue)} note="Current cost value" tone="purple" /></div>
        <div className="report-grid"><div className="data-card chart-card"><div className="card-title"><div><h3>Sales Overview</h3><p>Daily sales performance</p></div><select><option>Last 7 Days</option><option>This Month</option><option>This Year</option></select></div><div className="bar-chart">{[35,52,41,78,64,90,58].map((h,i) => <div key={i}><span style={{height:`${h}%`}} /><b>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</b></div>)}</div></div><div className="data-card breakdown"><div className="card-title"><div><h3>Payment Methods</h3><p>Share of collected sales</p></div></div>{[["Cash",62,"green"],["GCash",23,"blue"],["Maya",10,"purple"],["Bank",5,"orange"]].map(([label, value, tone]) => <div className="break-row" key={String(label)}><span>{label}</span><div><i className={String(tone)} style={{width:`${value}%`}} /></div><b>{value}%</b></div>)}</div></div>
        <div className="report-links"><button><span>▤</span><b>Daily Sales Report</b><small>Detailed transactions and payments</small></button><button><span>▦</span><b>Inventory Report</b><small>Stocks, valuation and low items</small></button><button><span>₱</span><b>Profit & Loss</b><small>Sales, expenses and net profit</small></button><button><span>▣</span><b>Supplier Balance</b><small>Credits, payments and due dates</small></button></div>
      </>}

      {view === "staff" && <>
        <div className="metric-grid three"><Metric icon="♙" label="Active Staff" value={String(data.employees.filter(r=>r.status==="Active").length)} note="Current employees" tone="blue" /><Metric icon="₱" label="Gross Payroll" value={peso(data.employees.reduce((s,r)=>s+r.dailyRate*r.workDays,0))} note="Current pay period" tone="green" /><Metric icon="↙" label="Store Credits" value={peso(data.employees.reduce((s,r)=>s+r.storeCredit,0))} note="Salary deductions" tone="orange" /></div>
        <div className="data-card"><div className="data-toolbar"><span className="pay-period">Pay Period: <b>Aug 1–15, 2026</b></span><button onClick={() => window.print()}>▤ Print All Payslips</button></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Role</th><th>Work Days</th><th>Rate / Day</th><th>Gross Salary</th><th>Store Credit</th><th>Net Salary</th><th>Status</th></tr></thead><tbody>{data.employees.map(r => <tr key={r.id}><td><b>{r.fullName}</b></td><td>{r.role}</td><td>{r.workDays}</td><td>{peso(r.dailyRate)}</td><td>{peso(r.dailyRate*r.workDays)}</td><td className="orange-text">−{peso(r.storeCredit)}</td><td><b className="green-text">{peso(r.dailyRate*r.workDays-r.storeCredit)}</b></td><td><Status tone="green">{r.status}</Status></td></tr>)}</tbody></table></div></div>
      </>}

      {view === "settings" && <Settings online={online} products={products} data={data} />}

      {modal && <ActionModal type={modal} saving={saving} onClose={() => setModal(null)} onSubmit={submit} />}
    </section>
  );
}

function Metric({icon,label,value,note,tone}:{icon:string;label:string;value:string;note:string;tone:string}) { return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article> }
function Status({tone,children}:{tone:string;children:React.ReactNode}) { return <span className={`status ${tone}`}>{children}</span> }
function EmptyRow({columns,text}:{columns:number;text:string}) { return <tr><td colSpan={columns}><div className="empty-table"><span>▤</span><b>{text}</b></div></td></tr> }

function Settings({online,products,data}:{online:boolean;products:ProductRecord[];data:PosData}) {
  const [receipt,setReceipt]=useState(true); const [sound,setSound]=useState(true); const [lowStock,setLowStock]=useState(true);
  function backup() { const blob=new Blob([JSON.stringify({products,...data,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`swirl-dry-pos-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); }
  return <><div className="settings-grid"><div className="data-card settings-card"><div className="card-title"><div><h3>Store Information</h3><p>Printed on receipts and reports</p></div></div><label>Business Name<input defaultValue="SWIRL-DRY AND SARI-SARI STORE" /></label><label>Address<input defaultValue="Buting, Pasig City" /></label><label>Receipt Footer<input defaultValue="Maraming salamat po! Please come again." /></label><button className="primary-small">Save Changes</button></div><div className="data-card settings-card"><div className="card-title"><div><h3>Printer & Devices</h3><p>Tablet hardware connections</p></div></div><div className="device-row"><span>▤</span><div><b>Bluetooth Receipt Printer</b><small>Ready · 58mm paper</small></div><Status tone="green">Connected</Status></div><div className="device-row"><span>▥</span><div><b>Barcode Scanner</b><small>USB / Bluetooth HID</small></div><Status tone="green">Ready</Status></div><div className="device-row"><span>▣</span><div><b>Cash Drawer</b><small>Opens after cash sale</small></div><Status tone="blue">Auto</Status></div></div><div className="data-card settings-card"><div className="card-title"><div><h3>POS Preferences</h3><p>Cashier behavior</p></div></div><Toggle label="Auto-print receipt" checked={receipt} set={setReceipt} /><Toggle label="Button and scan sounds" checked={sound} set={setSound} /><Toggle label="Low-stock warnings" checked={lowStock} set={setLowStock} /><Toggle label="Require end-shift count" checked={true} set={()=>{}} /></div><div className="data-card settings-card"><div className="card-title"><div><h3>Data & Security</h3><p>Protect business records</p></div></div><div className="backup-status"><span>✓</span><div><b>{online ? "Cloud database connected" : "Connecting to database"}</b><small>Records survive reloads and device changes</small></div></div><button className="secondary-wide" onClick={backup}>⇩ Download Backup</button><button className="secondary-wide">♙ Manage Staff Access</button></div></div></>
}
function Toggle({label,checked,set}:{label:string;checked:boolean;set:(v:boolean)=>void}) { return <button className="toggle-row" onClick={()=>set(!checked)}><span>{label}</span><i className={checked?"on":""}><b /></i></button> }

function ActionModal({type,saving,onClose,onSubmit}:{type:string;saving:boolean;onClose:()=>void;onSubmit:(e:React.FormEvent<HTMLFormElement>,action:string)=>void}) {
  const stock = typeof window !== "undefined" ? JSON.parse(sessionStorage.getItem("stockProduct") || "null") : null;
  const action = type === "inventory" ? "createProduct" : type === "expenses" ? "createExpense" : type === "suppliers" ? "createSupplier" : type === "customers" ? "createCustomer" : type === "staff" ? "createEmployee" : "stockIn";
  const titles:Record<string,string>={inventory:"Add New Product",expenses:"Record Expense",suppliers:"Add Supplier",customers:"Add Customer",staff:"Add Employee",stock:"Stock In"};
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={titles[type]}><form className="form-modal" onSubmit={(e)=>onSubmit(e,action)}><div className="form-head"><div><small>BACK OFFICE</small><h2>{titles[type]}</h2></div><button type="button" onClick={onClose}>×</button></div>{type==="inventory"&&<><div className="form-grid"><label>Product Name<input name="name" required placeholder="e.g. Coca-Cola 1.5L" /></label><label>Barcode<input name="barcode" required placeholder="Scan or enter barcode" /></label><label>Category<select name="category"><option>Beverages</option><option>Groceries</option><option>Snacks</option><option>Household</option><option>Personal Care</option><option>Others</option></select></label><label>Product Cost<input name="cost" type="number" step="0.01" required /></label><label>Retail Price<input name="retailPrice" type="number" step="0.01" required /></label><label>Wholesale Price<input name="wholesalePrice" type="number" step="0.01" required /></label><label>Opening Stock<input name="stock" type="number" required /></label><label>Low Stock Alert<input name="minStock" type="number" defaultValue="5" required /></label><label>Expiry Date<input name="expiryDate" type="date" /></label></div></>}{type==="expenses"&&<div className="form-grid"><label>Category<select name="category"><option>Utilities</option><option>Delivery</option><option>Supplies</option><option>Rent</option><option>Salary</option><option>Others</option></select></label><label>Amount<input name="amount" type="number" step="0.01" required /></label><label className="wide">Description<input name="description" required placeholder="What was this expense for?" /></label><label>Payment Method<select name="paymentMethod"><option>Cash</option><option>GCash</option><option>Maya</option><option>Bank Transfer</option></select></label><label>Notes<input name="notes" /></label></div>}{type==="suppliers"&&<div className="form-grid"><label>Supplier Name<input name="name" required /></label><label>Contact Number<input name="contactNo" /></label><label>Total Credit<input name="totalCredit" type="number" step="0.01" /></label><label>Amount Paid<input name="amountPaid" type="number" step="0.01" /></label><label>Due Date<input name="dueDate" type="date" /></label><label>Notes<input name="notes" /></label></div>}{type==="customers"&&<div className="form-grid"><label>Customer Name<input name="name" required /></label><label>Contact Number<input name="contactNo" /></label><label>Credit Limit<input name="creditLimit" type="number" step="0.01" /></label><label>Current Utang<input name="balance" type="number" step="0.01" /></label><label className="wide">Notes<input name="notes" /></label></div>}{type==="staff"&&<div className="form-grid"><label>Full Name<input name="fullName" required /></label><label>Position<select name="role"><option>Cashier</option><option>Supervisor</option><option>Stock Clerk</option><option>Payroll Encoder</option><option>Admin</option></select></label><label>Daily Rate<input name="dailyRate" type="number" step="0.01" /></label><label>Work Days<input name="workDays" type="number" step="0.5" /></label><label>Store Credit<input name="storeCredit" type="number" step="0.01" /></label><label>Status<select name="status"><option>Active</option><option>Inactive</option></select></label></div>}{type==="stock"&&<><input type="hidden" name="productId" value={stock?.id||""}/><div className="stock-product"><span style={{background:stock?.color}}>{stock?.icon}</span><div><b>{stock?.name}</b><small>Current stock: {stock?.stock}</small></div></div><label className="single-field">Quantity to Add<input name="quantity" type="number" min="1" required autoFocus /></label></>}<div className="form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving?"Saving…":"Save Record"}</button></div></form></div>
}

function titleFor(view:string){return ({inventory:"Inventory Management",sales:"Sales Transactions",customers:"Customers & Utang",suppliers:"Supplier Accounts",expenses:"Expenses",reports:"Business Reports",staff:"Staff & Payroll",settings:"POS Settings"} as Record<string,string>)[view]||"Back Office"}
function subtitleFor(view:string){return ({inventory:"Track products, barcode, pricing, stock and expiry dates.",sales:"Review every sale, payment channel and cashier transaction.",customers:"Manage suki profiles, credit limits, utang and payments.",suppliers:"Monitor supplier invoices, balances and due dates.",expenses:"Record every business expense for accurate profit reports.",reports:"Sales, expenses, profit, inventory and payment performance.",staff:"Manage employees, work days, salary and store-credit deductions.",settings:"Business details, devices, receipts, backups and staff access."} as Record<string,string>)[view]||""}
function primaryAction(view:string,open:()=>void){const labels:Record<string,string>={inventory:"+ Add Product",customers:"+ Add Customer",suppliers:"+ Add Supplier",expenses:"+ Record Expense",staff:"+ Add Employee"};return labels[view]?<button className="primary-action" onClick={open}>{labels[view]}</button>:null}
function dueTone(value?:string|null){if(!value)return"green";const days=Math.ceil((new Date(value).getTime()-Date.now())/86400000);return days<0?"red":days<=7?"orange":"green"}
function dueLabel(value?:string|null){if(!value)return"No Due Date";const days=Math.ceil((new Date(value).getTime()-Date.now())/86400000);return days<0?`${Math.abs(days)} days overdue`:days===0?"Due today":`${days} days left`}
