"use client";

import { useEffect, useMemo, useState } from "react";
import Backoffice, { type PosData, type ProductRecord } from "./backoffice";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  wholesale: number;
  stock: number;
  icon: string;
  color: string;
  barcode: string;
  cost?: number;
  minStock?: number;
  expiryDate?: string | null;
};

type CartLine = Product & { qty: number };

const products: Product[] = [
  { id: 1, name: "Coca-Cola 1.5L", category: "Beverages", price: 78, wholesale: 73, stock: 24, icon: "🥤", color: "#fee2e2", barcode: "4801981118863" },
  { id: 2, name: "Royal 1.5L", category: "Beverages", price: 76, wholesale: 71, stock: 18, icon: "🍊", color: "#ffedd5", barcode: "4801981118870" },
  { id: 3, name: "Mineral Water 500ml", category: "Beverages", price: 18, wholesale: 15, stock: 48, icon: "💧", color: "#dbeafe", barcode: "4800016020522" },
  { id: 4, name: "Lucky Me Pancit Canton", category: "Groceries", price: 17, wholesale: 15, stock: 63, icon: "🍜", color: "#fef3c7", barcode: "4807770272136" },
  { id: 5, name: "555 Sardines 155g", category: "Groceries", price: 27, wholesale: 25, stock: 36, icon: "🐟", color: "#e0e7ff", barcode: "748485102235" },
  { id: 6, name: "Argentina Corned Beef", category: "Groceries", price: 39, wholesale: 36, stock: 21, icon: "🥫", color: "#fce7f3", barcode: "4800016024070" },
  { id: 7, name: "Piattos Cheese 85g", category: "Snacks", price: 44, wholesale: 40, stock: 12, icon: "🍟", color: "#ede9fe", barcode: "4800016642014" },
  { id: 8, name: "SkyFlakes Crackers", category: "Snacks", price: 9, wholesale: 8, stock: 52, icon: "🍘", color: "#ecfccb", barcode: "4800016001019" },
  { id: 9, name: "Kopiko Brown Twin", category: "Beverages", price: 14, wholesale: 12, stock: 34, icon: "☕", color: "#f3e8d4", barcode: "8996001414001" },
  { id: 10, name: "Surf Powder 70g", category: "Household", price: 17, wholesale: 15, stock: 29, icon: "🫧", color: "#cffafe", barcode: "4800888600365" },
  { id: 11, name: "Sunsilk Shampoo Sachet", category: "Personal Care", price: 8, wholesale: 7, stock: 41, icon: "🧴", color: "#fce7f3", barcode: "4800888151041" },
  { id: 12, name: "Gardenia Classic Loaf", category: "Groceries", price: 76, wholesale: 71, stock: 8, icon: "🍞", color: "#ffedd5", barcode: "4806504710012" },
];

const categories = ["All", "Beverages", "Groceries", "Snacks", "Household", "Personal Care"];

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function PosClient() {
  const [view, setView] = useState("pos");
  const [productList, setProductList] = useState<Product[]>(products);
  const [data, setData] = useState<PosData>({ sales: [], expenses: [], suppliers: [], customers: [], employees: [] });
  const [dbOnline, setDbOnline] = useState(false);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [priceMode, setPriceMode] = useState<"retail" | "wholesale">("retail");
  const [cart, setCart] = useState<CartLine[]>([
    { ...products[0], qty: 1 },
    { ...products[3], qty: 2 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [tendered, setTendered] = useState(0);
  const [receiptNo, setReceiptNo] = useState("SD-2026-08127");
  const [saveError, setSaveError] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  async function loadData() {
    try {
      const response = await fetch("/api/pos", { cache: "no-store" });
      if (!response.ok) throw new Error("Database unavailable");
      const payload = await response.json();
      const mapped = (payload.products as ProductRecord[]).map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.retailPrice, wholesale: p.wholesalePrice, stock: p.stock, icon: p.icon, color: p.color, barcode: p.barcode, cost: p.cost, minStock: p.minStock, expiryDate: p.expiryDate }));
      setProductList(mapped);
      setData({ sales: payload.sales ?? [], expenses: payload.expenses ?? [], suppliers: payload.suppliers ?? [], customers: payload.customers ?? [], employees: payload.employees ?? [] });
      setDbOnline(true);
    } catch {
      setDbOnline(false);
    }
  }

  useEffect(() => { const task = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(task); }, []);

  async function apiAction(action: string, actionData: Record<string, unknown>) {
    try {
      const response = await fetch("/api/pos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data: actionData }) });
      if (!response.ok) throw new Error("Unable to save record");
      await loadData();
      return true;
    } catch {
      setSaveError("Could not save. Check the internet connection and try again.");
      window.setTimeout(() => setSaveError(""), 3500);
      return false;
    }
  }

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return productList.filter((product) => {
      const inCategory = category === "All" || product.category === category;
      const matches = !needle || product.name.toLowerCase().includes(needle) || product.barcode.includes(needle);
      return inCategory && matches;
    });
  }, [category, query, productList]);

  const linePrice = (line: Product) => priceMode === "wholesale" ? line.wholesale : line.price;
  const subtotal = cart.reduce((sum, line) => sum + linePrice(line) * line.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        return current.map((line) => line.id === product.id ? { ...line, qty: Math.min(line.stock, line.qty + 1) } : line);
      }
      return [...current, { ...product, qty: 1 }];
    });
  }

  function updateQty(id: number, delta: number) {
    setCart((current) => current
      .map((line) => line.id === id ? { ...line, qty: Math.max(0, Math.min(line.stock, line.qty + delta)) } : line)
      .filter((line) => line.qty > 0));
  }

  function openPayment() {
    setTendered(Math.ceil(total / 100) * 100);
    setPaymentOpen(true);
  }

  async function completeSale() {
    const response = await fetch("/api/pos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "completeSale", data: { customerName: "Walk-in Customer", priceMode, paymentMethod, referenceNo, subtotal, discount, total, tendered, changeAmount: Math.max(0, tendered-total), cashier: "Anna Marquez", items: cart.map(line => ({ productId: line.id, productName: line.name, quantity: line.qty, unitPrice: linePrice(line), lineTotal: linePrice(line)*line.qty })) } }) }).catch(() => null);
    if (!response?.ok) { setSaveError("Sale was not saved. Please check the connection and try again."); return; }
    const payload = await response.json();
    setReceiptNo(payload.sale?.receiptNo ?? "SD-RECEIPT");
    setPaymentOpen(false);
    setReceiptOpen(true);
    setDbOnline(true);
    void loadData();
  }

  function newSale() {
    setCart([]);
    setDiscount(0);
    setTendered(0);
    setReferenceNo("");
    setReceiptOpen(false);
  }

  return (
    <main className="pos-shell">
      <header className="topbar">
        <div className="brand-mark">S<span>&</span>D</div>
        <div className="brand-copy">
          <strong>SWIRL & DRY</strong>
          <span>Sari-Sari Store POS</span>
        </div>
        <div className="topbar-stats">
          <div><small>Today&apos;s Sales</small><strong>{peso(data.sales.reduce((sum, sale) => sum + sale.total, 0))}</strong></div>
          <div><small>Transactions</small><strong>{data.sales.length}</strong></div>
        </div>
        <div className={`system-status ${dbOnline ? "" : "syncing"}`}><i /> {dbOnline ? "Cloud Saved" : "Connecting"}</div>
        <div className="cashier-chip">
          <div className="avatar">AM</div>
          <div><strong>Anna Marquez</strong><span>Admin Cashier</span></div>
        </div>
        <div className="clock"><strong>{now ? now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</strong><span>{now ? now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Loading date"}</span></div>
      </header>

      <aside className="sidebar" aria-label="Main menu">
        <button className={`nav-button ${view === "pos" ? "active" : ""}`} onClick={() => setView("pos")}><span>▦</span><b>POS</b></button>
        <button className={`nav-button ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}><span>▤</span><b>Inventory</b></button>
        <button className={`nav-button ${view === "sales" ? "active" : ""}`} onClick={() => setView("sales")}><span>↗</span><b>Sales</b></button>
        <button className={`nav-button ${view === "customers" ? "active" : ""}`} onClick={() => setView("customers")}><span>♙</span><b>Customers</b></button>
        <button className={`nav-button ${view === "suppliers" ? "active" : ""}`} onClick={() => setView("suppliers")}><span>▣</span><b>Suppliers</b></button>
        <button className={`nav-button ${view === "expenses" ? "active" : ""}`} onClick={() => setView("expenses")}><span>↙</span><b>Expenses</b></button>
        <button className={`nav-button ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}><span>▥</span><b>Reports</b></button>
        <button className={`nav-button ${view === "staff" ? "active" : ""}`} onClick={() => setView("staff")}><span>♙</span><b>Staff</b></button>
        <div className="sidebar-spacer" />
        <button className={`nav-button ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><span>⚙</span><b>Settings</b></button>
      </aside>

      {saveError && <div className="error-toast">! {saveError}</div>}
      {view === "pos" ? <>
      <section className="catalog-panel">
        <div className="search-row">
          <label className="search-box">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scan barcode or search product..." autoFocus />
            <kbd>F2</kbd>
          </label>
          <button className="scan-button" onClick={() => setQuery("")}><span>▥</span> Scan</button>
        </div>

        <div className="catalog-toolbar">
          <div className="category-tabs">
            {categories.map((item) => (
              <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
          <div className="price-switch" aria-label="Price type">
            <button className={priceMode === "retail" ? "active" : ""} onClick={() => setPriceMode("retail")}>Retail</button>
            <button className={priceMode === "wholesale" ? "active" : ""} onClick={() => setPriceMode("wholesale")}>Wholesale</button>
          </div>
        </div>

        <div className="product-grid">
          {filteredProducts.map((product) => (
            <button className="product-card" key={product.id} onClick={() => addToCart(product)}>
              <div className="product-art" style={{ background: product.color }}><span>{product.icon}</span></div>
              <div className="product-info">
                <strong>{product.name}</strong>
                <span>{product.category}</span>
                <div><b>{peso(linePrice(product))}</b><em className={product.stock <= 10 ? "low" : ""}>{product.stock} in stock</em></div>
              </div>
              <i>+</i>
            </button>
          ))}
        </div>

        <div className="quick-bar">
          <button><span>⌛</span><div><b>Hold Order</b><small>F6</small></div></button>
          <button><span>↶</span><div><b>Recall Order</b><small>F7</small></div></button>
          <button><span>♙</span><div><b>Add Customer</b><small>F8</small></div></button>
          <button className="shift" onClick={() => setShiftOpen(true)}><span>₱</span><div><b>End Shift</b><small>Close cashier</small></div></button>
        </div>
      </section>
      <section className="cart-panel">
        <div className="cart-heading">
          <div><h2>Current Order</h2><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span></div>
          <button onClick={() => setCart([])} disabled={!cart.length}>Clear</button>
        </div>
        <button className="customer-row"><span className="avatar light">+</span><div><b>Walk-in Customer</b><small>Add customer or store credit</small></div><i>›</i></button>

        <div className="cart-lines">
          {!cart.length && <div className="empty-cart"><span>🛒</span><h3>Ready for a new sale</h3><p>Tap a product or scan a barcode.</p></div>}
          {cart.map((line) => (
            <article className="cart-line" key={line.id}>
              <div className="mini-art" style={{ background: line.color }}>{line.icon}</div>
              <div className="line-copy"><strong>{line.name}</strong><span>{peso(linePrice(line))} each</span></div>
              <div className="qty-stepper"><button onClick={() => updateQty(line.id, -1)}>−</button><b>{line.qty}</b><button onClick={() => updateQty(line.id, 1)}>+</button></div>
              <b className="line-total">{peso(linePrice(line) * line.qty)}</b>
            </article>
          ))}
        </div>

        <div className="cart-summary">
          <div><span>Subtotal</span><b>{peso(subtotal)}</b></div>
          <button className="discount-row" onClick={() => setDiscount(discount ? 0 : Math.round(subtotal * .05))}><span>Discount</span><b>{discount ? `−${peso(discount)}` : "Add"}</b></button>
          <div className="grand-total"><span>Total</span><strong>{peso(total)}</strong></div>
          <button className="pay-button" disabled={!cart.length} onClick={openPayment}><span>Charge {peso(total)}</span><kbd>F10</kbd></button>
          <div className="payment-hints"><span>● Cash</span><span>● GCash</span><span>● Maya</span><span>● Bank</span></div>
        </div>
      </section>
      </> : <Backoffice view={view} products={productList.map(p => ({ id:p.id, barcode:p.barcode, name:p.name, category:p.category, cost:p.cost ?? 0, retailPrice:p.price, wholesalePrice:p.wholesale, stock:p.stock, minStock:p.minStock ?? 5, expiryDate:p.expiryDate, icon:p.icon, color:p.color }))} data={data} online={dbOnline} onAction={apiAction} />}

      {paymentOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment">
          <div className="payment-modal">
            <div className="modal-title"><div><small>AMOUNT DUE</small><h2>{peso(total)}</h2></div><button onClick={() => setPaymentOpen(false)}>×</button></div>
            <label className="field-label">Payment Method</label>
            <div className="method-grid">
              {["Cash", "GCash", "Maya", "Bank Transfer"].map((method) => <button key={method} className={paymentMethod === method ? "active" : ""} onClick={() => setPaymentMethod(method)}>{method === "Cash" ? "₱" : method === "GCash" ? "G" : method === "Maya" ? "M" : "⇄"}<span>{method}</span></button>)}
            </div>
            {paymentMethod === "Cash" ? <>
              <label className="field-label">Cash Received</label>
              <div className="tender-input"><span>₱</span><input type="number" value={tendered || ""} onChange={(e) => setTendered(Number(e.target.value))} /></div>
              <div className="cash-shortcuts">{[100, 200, 500, 1000].map((amount) => <button key={amount} onClick={() => setTendered(amount)}>₱{amount}</button>)}<button onClick={() => setTendered(total)}>Exact</button></div>
              <div className="change-row"><span>Change</span><strong>{peso(Math.max(0, tendered - total))}</strong></div>
            </> : <>
              <label className="field-label">Reference Number</label>
              <div className="tender-input reference"><input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder={`Enter ${paymentMethod} reference`} /></div>
            </>}
            <button className="complete-button" disabled={paymentMethod === "Cash" && tendered < total} onClick={completeSale}>Complete Sale · {peso(total)}</button>
          </div>
        </div>
      )}

      {receiptOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Sale completed">
          <div className="receipt-modal">
            <div className="success-check">✓</div>
            <h2>Payment Successful!</h2>
            <p>Transaction <b>#{receiptNo}</b> was completed.</p>
            <div className="receipt-card"><div><span>Total</span><b>{peso(total)}</b></div><div><span>Paid via</span><b>{paymentMethod}</b></div>{paymentMethod === "Cash" && <div><span>Change</span><b>{peso(Math.max(0, tendered - total))}</b></div>}</div>
            <div className="receipt-actions"><button>▤ Print Receipt</button><button>▣ QR Receipt</button></div>
            <button className="complete-button" onClick={newSale}>Start New Sale</button>
          </div>
        </div>
      )}
      {shiftOpen && <ShiftModal expectedCash={data.sales.filter(s => s.paymentMethod === "Cash").reduce((sum, s) => sum + s.total, 0)} onClose={() => setShiftOpen(false)} onSave={async (closingCash) => { const ok = await apiAction("endShift", { cashier: "Anna Marquez", openingCash: 1000, expectedCash: data.sales.filter(s => s.paymentMethod === "Cash").reduce((sum, s) => sum + s.total, 0), closingCash }); if (ok) setShiftOpen(false); }} />}
    </main>
  );
}

function ShiftModal({expectedCash,onClose,onSave}:{expectedCash:number;onClose:()=>void;onSave:(closingCash:number)=>Promise<void>}) {
  const denominations = [1000,500,200,100,50,20,10,5,1];
  const [counts,setCounts] = useState<Record<number,number>>({});
  const [saving,setSaving] = useState(false);
  const counted = denominations.reduce((sum,value)=>sum+value*(counts[value]||0),0);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="End Shift"><div className="shift-modal"><div className="form-head"><div><small>CASHIER CONTROL</small><h2>End Shift</h2></div><button onClick={onClose}>×</button></div><div className="shift-summary"><div><span>Opening Cash</span><b>{peso(1000)}</b></div><div><span>Expected Cash Sales</span><b>{peso(expectedCash)}</b></div></div><h3>Count Bills & Coins</h3><div className="denomination-grid">{denominations.map(value=><label key={value}><span>₱{value}</span><input type="number" min="0" value={counts[value]||""} onChange={e=>setCounts({...counts,[value]:Number(e.target.value)})}/><b>{peso(value*(counts[value]||0))}</b></label>)}</div><div className="shift-total"><span>Total Counted</span><strong>{peso(counted)}</strong></div><div className={`variance ${counted-expectedCash<0?"short":""}`}><span>Cash Variance</span><b>{peso(counted-expectedCash)}</b></div><button className="complete-button" disabled={saving} onClick={async()=>{setSaving(true);await onSave(counted);setSaving(false)}}>{saving?"Saving…":"Confirm & Close Shift"}</button></div></div>
}
