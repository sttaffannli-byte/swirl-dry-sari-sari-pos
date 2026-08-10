"use client";

/* eslint-disable @next/next/no-img-element */

import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Backoffice, { type CustomerRecord, type HeldOrderRecord, type PosData, type ProductRecord } from "./backoffice";

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
type ReceiptData = { saleId: number; receiptNo: string; createdAt: string; cashier: string; subtotal: number; discount: number; total: number; tendered: number; change: number; paymentMethod: string; referenceNo: string; customerName: string; items: Array<{ productName: string; quantity: number; unitPrice: number; lineTotal: number }> };

const todayText = () => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const emptyData = (): PosData => ({ sales: [], expenses: [], suppliers: [], customers: [], employees: [], heldOrders: [], customerTransactions: [], supplierTransactions: [], stockMovements: [], range: { from: todayText(), to: todayText() } });
const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value || 0);
const invoiceNumber = (receipt: Pick<ReceiptData, "saleId" | "createdAt">) => `INV-${(receipt.createdAt || todayText()).slice(0, 10).replaceAll("-", "")}-${String(receipt.saleId).padStart(6, "0")}`;

export default function PosClient() {
  const [accessMode, setAccessMode] = useState<"cashier" | "manager">("cashier");
  const [view, setView] = useState("pos");
  const [productList, setProductList] = useState<Product[]>([]);
  const [data, setData] = useState<PosData>(emptyData);
  const [todaySummary, setTodaySummary] = useState({ count: 0, total: 0, cash: 0 });
  const [dbOnline, setDbOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [priceMode, setPriceMode] = useState<"retail" | "wholesale">("retail");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptMode, setReceiptMode] = useState<"new" | "reprint">("new");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerPinConfigured, setManagerPinConfigured] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [tendered, setTendered] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rangeRef = useRef({ from: todayText(), to: todayText() });
  const autoPrintedRef = useRef("");

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);
  const showError = useCallback((message: string) => {
    setSaveError(message);
    window.setTimeout(() => setSaveError(""), 4200);
  }, []);

  const playTone = useCallback((frequency = 720) => {
    if (data.settings?.soundEnabled === false) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.05, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.08); oscillator.addEventListener("ended", () => void context.close());
    } catch { /* Sound is optional and must never block a sale. */ }
  }, [data.settings?.soundEnabled]);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  const loadData = useCallback(async (from = rangeRef.current.from, to = rangeRef.current.to) => {
    rangeRef.current = { from, to };
    try {
      const response = await fetch(`/api/pos?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || "Database unavailable"));
      const mapped = ((payload.products ?? []) as ProductRecord[]).map((product) => ({ id: product.id, name: product.name, category: product.category, price: product.retailPrice, wholesale: product.wholesalePrice, stock: product.stock, icon: product.icon, color: product.color, barcode: product.barcode, cost: product.cost, minStock: product.minStock, expiryDate: product.expiryDate }));
      setProductList(mapped);
      setData({
        sales: payload.sales ?? [], expenses: payload.expenses ?? [], suppliers: payload.suppliers ?? [], customers: payload.customers ?? [], employees: payload.employees ?? [],
        heldOrders: payload.heldOrders ?? [], customerTransactions: payload.customerTransactions ?? [], supplierTransactions: payload.supplierTransactions ?? [],
        stockMovements: payload.stockMovements ?? [], settings: payload.settings, range: payload.range ?? { from, to },
      });
      setManagerPinConfigured(Boolean(payload.managerPinConfigured));
      setTodaySummary({ count: Number(payload.todaySummary?.count || 0), total: Number(payload.todaySummary?.total || 0), cash: Number(payload.todaySummary?.cash || 0) });
      setDbOnline(true);
    } catch (error) {
      setDbOnline(false);
      if (!productList.length) showError(error instanceof Error ? error.message : "Could not connect to the database.");
    } finally {
      setLoading(false);
    }
  }, [productList.length, showError]);

  useEffect(() => { void loadData(todayText(), todayText()); }, [loadData]);

  const onRangeChange = useCallback((from: string, to: string) => { void loadData(from, to); }, [loadData]);

  const apiAction = useCallback(async (action: string, actionData: Record<string, unknown>) => {
    try {
      const response = await fetch("/api/pos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data: actionData }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) { setAccessMode("cashier"); setView("pos"); }
        throw new Error(String(payload.error || "Unable to save record"));
      }
      await loadData();
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save. Check the connection and try again.");
      return false;
    }
  }, [loadData, showError]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(productList.map((product) => product.category))).sort()], [productList]);
  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return productList.filter((product) => (category === "All" || product.category === category) && (!needle || product.name.toLowerCase().includes(needle) || product.barcode.includes(needle)));
  }, [category, query, productList]);
  const linePrice = (line: Product) => priceMode === "wholesale" ? line.wholesale : line.price;
  const subtotal = cart.reduce((sum, line) => sum + linePrice(line) * line.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    if (product.stock <= 0) return showError(`${product.name} is out of stock.`);
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      const currentQuantity = existing?.qty || 0;
      const nextQuantity = Math.min(product.stock, currentQuantity + Math.max(1, quantity));
      if (existing) return current.map((line) => line.id === product.id ? { ...line, qty: nextQuantity } : line);
      return [...current, { ...product, qty: nextQuantity }];
    });
    if (quantity > product.stock) showError(`Only ${product.stock} ${product.name} available.`);
    playTone();
  }, [playTone, showError]);

  function scanOrSearch() {
    const raw = query.trim();
    if (!raw) return searchRef.current?.focus();
    const quantityMatch = raw.match(/^(\d+)\s*\*\s*(.+)$/);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    const barcode = (quantityMatch?.[2] || raw).trim();
    const product = productList.find((item) => item.barcode === barcode);
    if (!product) return showError(`Barcode ${barcode} was not found.`);
    addToCart(product, quantity);
    setQuery("");
    showToast(`${Math.min(quantity, product.stock)} × ${product.name} added`);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function updateQty(id: number, delta: number) {
    setCart((current) => current.map((line) => line.id === id ? { ...line, qty: Math.max(0, Math.min(line.stock, line.qty + delta)) } : line).filter((line) => line.qty > 0));
  }

  function openPayment() {
    if (!dbOnline) return showError("Connect to the cloud database before charging a sale.");
    if (!cart.length) return;
    setPaymentMethod("Cash"); setReferenceNo(""); setTendered(Math.ceil(total / 100) * 100); setPaymentOpen(true);
  }

  async function completeSale() {
    if (savingSale) return;
    if (["GCash", "Maya", "Bank Transfer"].includes(paymentMethod) && !referenceNo.trim()) return showError("Enter the payment reference number.");
    if (paymentMethod === "Utang" && !selectedCustomer) return showError("Select a registered customer for utang.");
    setSavingSale(true);
    try {
      const response = await fetch("/api/pos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "completeSale", data: { customerId: selectedCustomer?.id, priceMode, paymentMethod, referenceNo, discount, tendered, cashier: "Anna Marquez", items: cart.map((line) => ({ productId: line.id, quantity: line.qty })) } }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || "Sale was not saved."));
      const receipt: ReceiptData = { saleId: payload.sale.id, receiptNo: payload.sale.receiptNo, createdAt: payload.sale.createdAt, cashier: payload.sale.cashier, subtotal: payload.sale.subtotal, discount: payload.sale.discount, total: payload.sale.total, tendered: payload.sale.tendered, change: payload.sale.changeAmount, paymentMethod: payload.sale.paymentMethod, referenceNo: payload.sale.referenceNo || "", customerName: payload.sale.customerName, items: payload.items ?? [] };
      setLastReceipt(receipt); setReceiptMode("new"); setPaymentOpen(false); setReceiptOpen(true); setDbOnline(true);
      playTone(980);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sale was not saved. Please try again.");
    } finally {
      setSavingSale(false);
    }
  }

  function newSale() {
    setCart([]); setDiscount(0); setTendered(0); setReferenceNo(""); setSelectedCustomer(null); setReceiptOpen(false); setReceiptMode("new"); setLastReceipt(null); setQrDataUrl("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  async function reprintSale(saleId: number) {
    try {
      const response = await fetch("/api/pos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "getSaleReceipt", data: { saleId } }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || "Receipt could not be loaded."));
      const receipt: ReceiptData = { saleId: payload.sale.id, receiptNo: payload.sale.receiptNo, createdAt: payload.sale.createdAt, cashier: payload.sale.cashier, subtotal: payload.sale.subtotal, discount: payload.sale.discount, total: payload.sale.total, tendered: payload.sale.tendered, change: payload.sale.changeAmount, paymentMethod: payload.sale.paymentMethod, referenceNo: payload.sale.referenceNo || "", customerName: payload.sale.customerName, items: payload.items ?? [] };
      setLastReceipt(receipt); setReceiptMode("reprint"); setReceiptOpen(true); setQrDataUrl("");
    } catch (error) { showError(error instanceof Error ? error.message : "Receipt could not be loaded."); }
  }

  async function requestManagerAccess(pin: string) {
    try {
      const action = managerPinConfigured ? "verifyManagerPin" : "setManagerPin";
      const response = await fetch("/api/pos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data: { pin } }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || "Manager access failed."));
      setManagerPinConfigured(true); setManagerOpen(false); setAccessMode("manager"); setView("sales"); showToast("Manager mode unlocked");
      return true;
    } catch (error) { showError(error instanceof Error ? error.message : "Manager access failed."); return false; }
  }

  async function leaveManagerMode() {
    await fetch("/api/pos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "managerLogout", data: {} }) }).catch(() => null);
    setAccessMode("cashier"); setView("pos"); showToast("Cashier mode active");
  }

  async function holdOrder(label: string) {
    const ok = await apiAction("holdOrder", { label, customerId: selectedCustomer?.id, priceMode, discount, cartJson: JSON.stringify(cart.map((line) => ({ productId: line.id, qty: line.qty }))) });
    if (ok) { setCart([]); setDiscount(0); setSelectedCustomer(null); setHoldOpen(false); showToast("Order held safely"); }
  }

  async function recallOrder(order: HeldOrderRecord) {
    try {
      const saved = JSON.parse(order.cartJson) as Array<{ productId: number; qty: number }>;
      const restored = saved.map((item) => { const product = productList.find((row) => row.id === item.productId); return product ? { ...product, qty: Math.min(product.stock, item.qty) } : null; }).filter((row): row is CartLine => Boolean(row && row.qty > 0));
      if (!restored.length) throw new Error("The held items are no longer available.");
      setCart(restored); setPriceMode(order.priceMode === "wholesale" ? "wholesale" : "retail"); setDiscount(order.discount);
      setSelectedCustomer(data.customers.find((customer) => customer.id === order.customerId) || null);
      await apiAction("deleteHeldOrder", { heldOrderId: order.id }); setRecallOpen(false); setView("pos"); showToast("Held order restored");
    } catch (error) { showError(error instanceof Error ? error.message : "Could not restore the held order."); }
  }

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if (event.key === "F2") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "F6" && cart.length) { event.preventDefault(); setHoldOpen(true); }
      if (event.key === "F7") { event.preventDefault(); setRecallOpen(true); }
      if (event.key === "F8") { event.preventDefault(); setCustomerOpen(true); }
      if (event.key === "F10" && cart.length) { event.preventDefault(); openPayment(); }
      if (event.key === "Escape") { setPaymentOpen(false); setCustomerOpen(false); setHoldOpen(false); setRecallOpen(false); setDiscountOpen(false); }
    }
    window.addEventListener("keydown", shortcuts); return () => window.removeEventListener("keydown", shortcuts);
  });

  useEffect(() => {
    if (!receiptOpen || !lastReceipt) return;
    QRCode.toDataURL(JSON.stringify({ store: data.settings?.businessName || "Ate Anna's Store POS", invoice: invoiceNumber(lastReceipt), receipt: lastReceipt.receiptNo, total: lastReceipt.total, paidVia: lastReceipt.paymentMethod }), { width: 220, margin: 1, errorCorrectionLevel: "M" }).then((url) => {
      setQrDataUrl(url);
      if (data.settings?.autoPrint && autoPrintedRef.current !== lastReceipt.receiptNo) {
        autoPrintedRef.current = lastReceipt.receiptNo;
        window.setTimeout(() => window.print(), 500);
      }
    }).catch(() => setQrDataUrl(""));
  }, [receiptOpen, lastReceipt, data.settings?.businessName, data.settings?.autoPrint]);

  return (
    <main className="pos-shell">
      <header className="topbar"><div className="brand-mark">A<span>A</span></div><div className="brand-copy"><strong>ATE ANNA&apos;S</strong><span>Store POS</span></div><div className="topbar-stats"><div><small>Today&apos;s Sales</small><strong>{peso(todaySummary.total)}</strong></div><div><small>Transactions</small><strong>{todaySummary.count}</strong></div></div><div className={`system-status ${dbOnline ? "" : "syncing"}`}><i /> {loading ? "Loading" : dbOnline ? "Cloud Saved" : "Offline"}</div><div className={`access-badge ${accessMode}`}><span>{accessMode === "cashier" ? "▦" : "⚙"}</span><div><strong>{accessMode === "cashier" ? "Cashier Mode" : "Manager Mode"}</strong><small>{accessMode === "cashier" ? "POS access only" : "Back Office unlocked"}</small></div></div><div className="cashier-chip"><div className="avatar">AM</div><div><strong>Anna Marquez</strong><span>Active Cashier</span></div></div><div className="clock"><strong>{now ? now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</strong><span>{now ? now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Loading date"}</span></div></header>

      <aside className="sidebar" aria-label="Main menu"><button className={`nav-button ${view === "pos" ? "active" : ""}`} onClick={() => setView("pos")}><span>▦</span><b>POS</b></button>{accessMode === "manager" && <><button className={`nav-button ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}><span>▤</span><b>Inventory</b></button><button className={`nav-button ${view === "sales" ? "active" : ""}`} onClick={() => setView("sales")}><span>↗</span><b>Sales</b></button><button className={`nav-button ${view === "customers" ? "active" : ""}`} onClick={() => setView("customers")}><span>♙</span><b>Customers</b></button><button className={`nav-button ${view === "suppliers" ? "active" : ""}`} onClick={() => setView("suppliers")}><span>▣</span><b>Suppliers</b></button><button className={`nav-button ${view === "expenses" ? "active" : ""}`} onClick={() => setView("expenses")}><span>↙</span><b>Expenses</b></button><button className={`nav-button ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}><span>▥</span><b>Reports</b></button><button className={`nav-button ${view === "staff" ? "active" : ""}`} onClick={() => setView("staff")}><span>♙</span><b>Staff</b></button><button className={`nav-button ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><span>⚙</span><b>Settings</b></button></>}<div className="sidebar-spacer" />{accessMode === "cashier" ? <button className="nav-button manager-access" onClick={() => setManagerOpen(true)}><span>🔒</span><b>Manager</b></button> : <button className="nav-button manager-access" onClick={() => void leaveManagerMode()}><span>↩</span><b>Cashier</b></button>}</aside>

      {saveError && <div className="error-toast">! {saveError}</div>}{toast && <div className="toast">✓ {toast}</div>}
      {view === "pos" ? <><section className="catalog-panel"><div className="search-row"><label className="search-box"><span>⌕</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); scanOrSearch(); } }} placeholder="Scan barcode, type 4*barcode, or search..." autoFocus /><kbd>F2</kbd></label><button className="scan-button" onClick={scanOrSearch}><span>▥</span> Add</button></div><div className="catalog-toolbar"><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="price-switch" aria-label="Price type"><button className={priceMode === "retail" ? "active" : ""} onClick={() => setPriceMode("retail")}>Retail</button><button className={priceMode === "wholesale" ? "active" : ""} onClick={() => setPriceMode("wholesale")}>Wholesale</button></div></div><div className="product-grid">{loading && !productList.length ? <div className="catalog-empty">Loading products…</div> : filteredProducts.length ? filteredProducts.map((product) => <button className="product-card" key={product.id} disabled={!product.stock} onClick={() => addToCart(product)}><div className="product-art" style={{ background: product.color }}><span>{product.icon}</span></div><div className="product-info"><strong>{product.name}</strong><span>{product.category}</span><div><b>{peso(linePrice(product))}</b><em className={product.stock <= (product.minStock || 5) ? "low" : ""}>{product.stock} in stock</em></div></div><i>+</i></button>) : <div className="catalog-empty">No products match your search.</div>}</div><div className="quick-bar"><button disabled={!cart.length} onClick={() => setHoldOpen(true)}><span>⌛</span><div><b>Hold Sale</b><small>F6</small></div></button><button onClick={() => setRecallOpen(true)}><span>↶</span><div><b>Recall Sale</b><small>{data.heldOrders.length} held · F7</small></div></button><button disabled={!data.sales.length} onClick={() => data.sales[0] && void reprintSale(data.sales[0].id)}><span>▤</span><div><b>Reprint Last</b><small>{data.sales[0]?.receiptNo || "No receipt"}</small></div></button><button className="shift" onClick={() => setShiftOpen(true)}><span>₱</span><div><b>End Shift</b><small>Close cashier</small></div></button></div></section>
        <section className="cart-panel"><div className="cart-heading"><div><h2>Current Order</h2><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span></div><button onClick={() => setCart([])} disabled={!cart.length}>Clear</button></div><button className="customer-row" onClick={() => setCustomerOpen(true)}><span className="avatar light">{selectedCustomer ? selectedCustomer.name.slice(0, 1).toUpperCase() : "+"}</span><div><b>{selectedCustomer?.name || "Walk-in Customer"}</b><small>{selectedCustomer ? `Utang ${peso(selectedCustomer.balance)} · Available ${peso(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.balance))}` : "Tap to select customer or use store credit"}</small></div><i>›</i></button><div className="cart-lines">{!cart.length && <div className="empty-cart"><span>🛒</span><h3>Ready for a new sale</h3><p>Tap a product or scan a barcode.</p></div>}{cart.map((line) => <article className="cart-line" key={line.id}><div className="mini-art" style={{ background: line.color }}>{line.icon}</div><div className="line-copy"><strong>{line.name}</strong><span>{peso(linePrice(line))} each</span></div><div className="qty-stepper"><button aria-label={`Remove one ${line.name}`} onClick={() => updateQty(line.id, -1)}>−</button><b>{line.qty}</b><button aria-label={`Add one ${line.name}`} onClick={() => updateQty(line.id, 1)}>+</button></div><b className="line-total">{peso(linePrice(line) * line.qty)}</b></article>)}</div><div className="cart-summary"><div><span>Subtotal</span><b>{peso(subtotal)}</b></div><button className="discount-row" onClick={() => setDiscountOpen(true)} disabled={!cart.length}><span>Discount</span><b>{discount ? `−${peso(discount)}` : "Add"}</b></button><div className="grand-total"><span>Total</span><strong>{peso(total)}</strong></div><button className="pay-button" disabled={!cart.length || !dbOnline} onClick={openPayment}><span>{dbOnline ? `Charge ${peso(total)}` : "Database Offline"}</span><kbd>F10</kbd></button><div className="payment-hints"><span>● Cash</span><span>● GCash</span><span>● Maya</span><span>● Bank</span><span>● Utang</span></div></div></section></> : <Backoffice view={view} products={productList.map((product) => ({ id: product.id, barcode: product.barcode, name: product.name, category: product.category, cost: product.cost ?? 0, retailPrice: product.price, wholesalePrice: product.wholesale, stock: product.stock, minStock: product.minStock ?? 5, expiryDate: product.expiryDate, icon: product.icon, color: product.color }))} data={data} online={dbOnline} onAction={apiAction} onRangeChange={onRangeChange} onReprintSale={reprintSale} />}

      {paymentOpen && <PaymentModal total={total} method={paymentMethod} setMethod={(method) => { setPaymentMethod(method); setReferenceNo(""); }} tendered={tendered} setTendered={setTendered} referenceNo={referenceNo} setReferenceNo={setReferenceNo} customer={selectedCustomer} saving={savingSale} onSelectCustomer={() => setCustomerOpen(true)} onClose={() => setPaymentOpen(false)} onComplete={() => void completeSale()} />}
      {customerOpen && <CustomerModal customers={data.customers} selected={selectedCustomer} onSelect={(customer) => { setSelectedCustomer(customer); setCustomerOpen(false); }} onWalkIn={() => { setSelectedCustomer(null); setCustomerOpen(false); if (paymentMethod === "Utang") setPaymentMethod("Cash"); }} onAdd={apiAction} onClose={() => setCustomerOpen(false)} />}
      {discountOpen && <DiscountModal subtotal={subtotal} current={discount} onApply={(amount) => { setDiscount(Math.min(subtotal, Math.max(0, amount))); setDiscountOpen(false); }} onClose={() => setDiscountOpen(false)} />}
      {holdOpen && <HoldModal defaultLabel={selectedCustomer?.name || ""} onSave={(label) => void holdOrder(label)} onClose={() => setHoldOpen(false)} />}
      {recallOpen && <RecallModal orders={data.heldOrders} onRecall={(order) => void recallOrder(order)} onClose={() => setRecallOpen(false)} />}
      {receiptOpen && lastReceipt && <ReceiptModal receipt={lastReceipt} qrDataUrl={qrDataUrl} footer={data.settings?.receiptFooter || "Maraming salamat po! Please come again."} mode={receiptMode} onNewSale={newSale} />}
      {managerOpen && <ManagerAccessModal configured={managerPinConfigured} onSubmit={requestManagerAccess} onClose={() => setManagerOpen(false)} />}
      {shiftOpen && <ShiftModal expectedCash={todaySummary.cash} onClose={() => setShiftOpen(false)} onSave={async (closingCash) => { const ok = await apiAction("endShift", { cashier: "Anna Marquez", openingCash: 1000, expectedCash: todaySummary.cash, closingCash }); if (ok) { setShiftOpen(false); showToast("Shift closed and cash count saved"); } }} />}
    </main>
  );
}

function PaymentModal({ total, method, setMethod, tendered, setTendered, referenceNo, setReferenceNo, customer, saving, onSelectCustomer, onClose, onComplete }: { total: number; method: string; setMethod: (value: string) => void; tendered: number; setTendered: (value: number) => void; referenceNo: string; setReferenceNo: (value: string) => void; customer: CustomerRecord | null; saving: boolean; onSelectCustomer: () => void; onClose: () => void; onComplete: () => void }) {
  const digital = ["GCash", "Maya", "Bank Transfer"].includes(method);
  const disabled = saving || (method === "Cash" && tendered < total) || (digital && !referenceNo.trim()) || (method === "Utang" && !customer);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment"><div className="payment-modal"><div className="modal-title"><div><small>AMOUNT DUE</small><h2>{peso(total)}</h2></div><button onClick={onClose}>×</button></div><label className="field-label">Payment Method</label><div className="method-grid five">{["Cash", "GCash", "Maya", "Bank Transfer", "Utang"].map((item) => <button key={item} className={method === item ? "active" : ""} onClick={() => setMethod(item)}>{item === "Cash" ? "₱" : item === "GCash" ? "G" : item === "Maya" ? "M" : item === "Utang" ? "U" : "⇄"}<span>{item}</span></button>)}</div>{method === "Cash" ? <><label className="field-label">Cash Received</label><div className="tender-input"><span>₱</span><input type="number" min="0" step="0.01" value={tendered || ""} onChange={(event) => setTendered(Number(event.target.value))} autoFocus /></div><div className="cash-shortcuts">{[100, 200, 500, 1000].map((amount) => <button key={amount} onClick={() => setTendered(amount)}>₱{amount}</button>)}<button onClick={() => setTendered(total)}>Exact</button></div><div className="change-row"><span>Change</span><strong>{peso(Math.max(0, tendered - total))}</strong></div></> : method === "Utang" ? <button className="credit-customer" onClick={onSelectCustomer}><span>♙</span><div><b>{customer?.name || "Select customer"}</b><small>{customer ? `Available credit: ${peso(Math.max(0, customer.creditLimit - customer.balance))}` : "A registered customer is required"}</small></div><i>›</i></button> : <><label className="field-label">Reference Number</label><div className="tender-input reference"><input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder={`Enter ${method} reference`} autoFocus /></div></>}<button className="complete-button" disabled={disabled} onClick={onComplete}>{saving ? "Saving Sale…" : `Complete Sale · ${peso(total)}`}</button></div></div>;
}

function CustomerModal({ customers, selected, onSelect, onWalkIn, onAdd, onClose }: { customers: CustomerRecord[]; selected: CustomerRecord | null; onSelect: (customer: CustomerRecord) => void; onWalkIn: () => void; onAdd: (action: string, data: Record<string, unknown>) => Promise<boolean>; onClose: () => void }) {
  const [query, setQuery] = useState(""); const [adding, setAdding] = useState(false); const [name, setName] = useState(""); const [contact, setContact] = useState(""); const [limit, setLimit] = useState(0);
  const filtered = customers.filter((customer) => `${customer.name} ${customer.contactNo}`.toLowerCase().includes(query.toLowerCase()));
  async function addCustomer() { if (!name.trim()) return; const ok = await onAdd("createCustomer", { name, contactNo: contact, creditLimit: limit, balance: 0 }); if (ok) { setAdding(false); setName(""); setContact(""); setLimit(0); } }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Select customer"><div className="form-modal customer-modal"><div className="form-head"><div><small>POS CUSTOMER</small><h2>Select Customer</h2></div><button onClick={onClose}>×</button></div>{adding ? <><div className="form-grid"><label>Customer Name<input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><label>Contact Number<input value={contact} onChange={(event) => setContact(event.target.value)} inputMode="tel" /></label><label>Credit Limit<input value={limit || ""} onChange={(event) => setLimit(Number(event.target.value))} type="number" min="0" /></label></div><div className="form-actions"><button onClick={() => setAdding(false)}>Back</button><button className="primary" disabled={!name.trim()} onClick={() => void addCustomer()}>Save Customer</button></div></> : <><div className="customer-tools"><label className="table-search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer" autoFocus /></label><button className="primary-action" onClick={() => setAdding(true)}>+ New</button></div><button className={`customer-choice ${!selected ? "selected" : ""}`} onClick={onWalkIn}><span>+</span><div><b>Walk-in Customer</b><small>No store credit</small></div></button><div className="customer-list">{filtered.map((customer) => <button className={`customer-choice ${selected?.id === customer.id ? "selected" : ""}`} key={customer.id} onClick={() => onSelect(customer)}><span>{customer.name.slice(0, 1).toUpperCase()}</span><div><b>{customer.name}</b><small>Utang {peso(customer.balance)} · Available {peso(Math.max(0, customer.creditLimit - customer.balance))}</small></div></button>)}{!filtered.length && <div className="list-empty">No customers found.</div>}</div></>}</div></div>;
}

function DiscountModal({ subtotal, current, onApply, onClose }: { subtotal: number; current: number; onApply: (amount: number) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"amount" | "percent">("amount"); const [value, setValue] = useState(current || 0); const calculated = mode === "percent" ? subtotal * Math.min(100, value) / 100 : value;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Discount"><div className="form-modal compact-modal"><div className="form-head"><div><small>CASHIER CONTROL</small><h2>Add Discount</h2></div><button onClick={onClose}>×</button></div><div className="discount-toggle"><button className={mode === "amount" ? "active" : ""} onClick={() => setMode("amount")}>Peso Amount</button><button className={mode === "percent" ? "active" : ""} onClick={() => setMode("percent")}>Percentage</button></div><label className="single-field">{mode === "amount" ? "Discount Amount" : "Discount Percentage"}<input type="number" min="0" max={mode === "percent" ? 100 : subtotal} step="0.01" value={value || ""} onChange={(event) => setValue(Number(event.target.value))} autoFocus /></label><div className="change-row"><span>Discount</span><strong>{peso(calculated)}</strong></div><div className="form-actions"><button onClick={() => onApply(0)}>Remove</button><button className="primary" onClick={() => onApply(calculated)}>Apply Discount</button></div></div></div>;
}

function HoldModal({ defaultLabel, onSave, onClose }: { defaultLabel: string; onSave: (label: string) => void; onClose: () => void }) { const [label, setLabel] = useState(defaultLabel); return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Hold order"><div className="form-modal compact-modal"><div className="form-head"><div><small>CASHIER CONTROL</small><h2>Hold Current Order</h2></div><button onClick={onClose}>×</button></div><label className="single-field">Order Label<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Customer name or order note" autoFocus /></label><div className="form-actions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(label.trim() || "Held Order")}>Hold Order</button></div></div></div>; }
function RecallModal({ orders, onRecall, onClose }: { orders: HeldOrderRecord[]; onRecall: (order: HeldOrderRecord) => void; onClose: () => void }) { return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Recall order"><div className="form-modal"><div className="form-head"><div><small>CASHIER CONTROL</small><h2>Recall Held Order</h2></div><button onClick={onClose}>×</button></div><div className="recall-list">{orders.map((order) => <button key={order.id} onClick={() => onRecall(order)}><span>⌛</span><div><b>{order.label}</b><small>{new Date(order.createdAt.replace(" ", "T") + "+08:00").toLocaleString("en-PH")} · {order.priceMode}</small></div><i>Recall ›</i></button>)}{!orders.length && <div className="list-empty">There are no held orders.</div>}</div></div></div>; }

function ReceiptModal({ receipt, qrDataUrl, footer, mode, onNewSale }: { receipt: ReceiptData; qrDataUrl: string; footer: string; mode: "new" | "reprint"; onNewSale: () => void }) { const invoiceNo = invoiceNumber(receipt); const receiptDate = new Date(receipt.createdAt.replace(" ", "T") + (receipt.createdAt.includes("T") ? "" : "+08:00")).toLocaleString("en-PH"); return <div className="modal-backdrop receipt-backdrop" role="dialog" aria-modal="true" aria-label={mode === "reprint" ? "Receipt reprint" : "Sale completed"}><div className="receipt-modal"><div className="success-check">{mode === "reprint" ? "▤" : "✓"}</div><h2>{mode === "reprint" ? "Receipt Ready to Reprint" : "Payment Successful!"}</h2><p>{mode === "reprint" ? <><b>{invoiceNo}</b> was loaded from Sales history.</> : <>Transaction <b>#{receipt.receiptNo}</b> was saved to the cloud.</>}</p><div className="printed-receipt"><div className="receipt-store"><b>ATE ANNA&apos;S</b><small>Store POS</small></div><div className="receipt-card receipt-meta"><div><span>Invoice No.</span><b>{invoiceNo}</b></div><div><span>Receipt No.</span><b>{receipt.receiptNo}</b></div><div><span>Date & Time</span><b>{receiptDate}</b></div><div><span>Cashier</span><b>{receipt.cashier}</b></div><div><span>Customer</span><b>{receipt.customerName}</b></div>{receipt.items.map((item, index) => <div key={`${item.productName}-${index}`}><span>{item.quantity} × {item.productName}</span><b>{peso(item.lineTotal)}</b></div>)}<div><span>Subtotal</span><b>{peso(receipt.subtotal)}</b></div>{receipt.discount > 0 && <div><span>Discount</span><b>−{peso(receipt.discount)}</b></div>}<div className="receipt-total"><span>Total</span><b>{peso(receipt.total)}</b></div><div><span>Paid via</span><b>{receipt.paymentMethod}</b></div>{receipt.referenceNo && <div><span>Reference</span><b>{receipt.referenceNo}</b></div>}{receipt.paymentMethod === "Cash" && <><div><span>Cash Received</span><b>{peso(receipt.tendered)}</b></div><div><span>Change</span><b>{peso(receipt.change)}</b></div></>}</div>{qrDataUrl && <img className="receipt-qr" src={qrDataUrl} alt="Receipt QR code" />}<small className="receipt-footer">{footer}</small></div><div className="receipt-actions"><button onClick={() => window.print()}>▤ {mode === "reprint" ? "Reprint Receipt" : "Print Receipt"}</button><button onClick={() => { if (!qrDataUrl) return; const anchor = document.createElement("a"); anchor.href = qrDataUrl; anchor.download = `${invoiceNo}-QR.png`; anchor.click(); }}>▣ Save QR</button></div><button className="complete-button" onClick={onNewSale}>{mode === "reprint" ? "Close Reprint" : "Start New Sale"}</button></div></div>; }

function ManagerAccessModal({ configured, onSubmit, onClose }: { configured: boolean; onSubmit: (pin: string) => Promise<boolean>; onClose: () => void }) {
  const [pin, setPin] = useState(""); const [confirmPin, setConfirmPin] = useState(""); const [saving, setSaving] = useState(false); const valid = /^\d{4,8}$/.test(pin) && (configured || pin === confirmPin);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Manager access"><form className="form-modal compact-modal manager-modal" onSubmit={async (event) => { event.preventDefault(); if (!valid) return; setSaving(true); await onSubmit(pin); setSaving(false); }}><div className="form-head"><div><small>SECURE ACCESS</small><h2>{configured ? "Manager PIN" : "Create Manager PIN"}</h2></div><button type="button" onClick={onClose}>×</button></div><p className="manager-note">{configured ? "Cashiers remain inside POS mode. Enter the manager PIN to unlock Inventory, Sales, Reports, Staff, and Settings." : "Set a 4–8 digit PIN. Cashier Mode will remain the default whenever the POS opens."}</p><label className="single-field">{configured ? "Enter PIN" : "New Manager PIN"}<input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} autoFocus /></label>{!configured && <label className="single-field manager-confirm">Confirm PIN<input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))} /></label>}<div className="form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={!valid || saving}>{saving ? "Checking…" : configured ? "Unlock Back Office" : "Save PIN & Unlock"}</button></div></form></div>;
}

function ShiftModal({ expectedCash, onClose, onSave }: { expectedCash: number; onClose: () => void; onSave: (closingCash: number) => Promise<void> }) { const denominations = [1000, 500, 200, 100, 50, 20, 10, 5, 1]; const [counts, setCounts] = useState<Record<number, number>>({}); const [saving, setSaving] = useState(false); const counted = denominations.reduce((sum, value) => sum + value * (counts[value] || 0), 0); return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="End Shift"><div className="shift-modal"><div className="form-head"><div><small>CASHIER CONTROL</small><h2>End Shift</h2></div><button onClick={onClose}>×</button></div><div className="shift-summary"><div><span>Opening Cash</span><b>{peso(1000)}</b></div><div><span>Expected Cash Sales</span><b>{peso(expectedCash)}</b></div></div><h3>Count Bills & Coins</h3><div className="denomination-grid">{denominations.map((value) => <label key={value}><span>₱{value}</span><input type="number" min="0" inputMode="numeric" value={counts[value] || ""} onChange={(event) => setCounts({ ...counts, [value]: Math.max(0, Number(event.target.value)) })} /><b>{peso(value * (counts[value] || 0))}</b></label>)}</div><div className="shift-total"><span>Total Counted</span><strong>{peso(counted)}</strong></div><div className={`variance ${counted - expectedCash < 0 ? "short" : ""}`}><span>Cash Variance</span><b>{peso(counted - expectedCash)}</b></div><button className="complete-button" disabled={saving} onClick={async () => { setSaving(true); await onSave(counted); setSaving(false); }}>{saving ? "Saving…" : "Confirm & Close Shift"}</button></div></div>; }
