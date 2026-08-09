import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerTransactions,
  customers,
  employees,
  expenses,
  heldOrders,
  products,
  saleItems,
  sales,
  shifts,
  stockMovements,
  storeSettings,
  supplierTransactions,
  suppliers,
} from "../../../db/schema";

const seedProducts = [
  { barcode: "4801981118863", name: "Coca-Cola 1.5L", category: "Beverages", cost: 66, retailPrice: 78, wholesalePrice: 73, stock: 24, minStock: 8, icon: "🥤", color: "#fee2e2" },
  { barcode: "4801981118870", name: "Royal 1.5L", category: "Beverages", cost: 64, retailPrice: 76, wholesalePrice: 71, stock: 18, minStock: 8, icon: "🍊", color: "#ffedd5" },
  { barcode: "4800016020522", name: "Mineral Water 500ml", category: "Beverages", cost: 12, retailPrice: 18, wholesalePrice: 15, stock: 48, minStock: 12, icon: "💧", color: "#dbeafe" },
  { barcode: "4807770272136", name: "Lucky Me Pancit Canton", category: "Groceries", cost: 13, retailPrice: 17, wholesalePrice: 15, stock: 63, minStock: 15, icon: "🍜", color: "#fef3c7" },
  { barcode: "748485102235", name: "555 Sardines 155g", category: "Groceries", cost: 22, retailPrice: 27, wholesalePrice: 25, stock: 36, minStock: 10, icon: "🐟", color: "#e0e7ff" },
  { barcode: "4800016024070", name: "Argentina Corned Beef", category: "Groceries", cost: 32, retailPrice: 39, wholesalePrice: 36, stock: 21, minStock: 8, icon: "🥫", color: "#fce7f3" },
  { barcode: "4800016642014", name: "Piattos Cheese 85g", category: "Snacks", cost: 36, retailPrice: 44, wholesalePrice: 40, stock: 12, minStock: 8, icon: "🍟", color: "#ede9fe" },
  { barcode: "4800016001019", name: "SkyFlakes Crackers", category: "Snacks", cost: 6.5, retailPrice: 9, wholesalePrice: 8, stock: 52, minStock: 15, icon: "🍘", color: "#ecfccb" },
  { barcode: "8996001414001", name: "Kopiko Brown Twin", category: "Beverages", cost: 10, retailPrice: 14, wholesalePrice: 12, stock: 34, minStock: 10, icon: "☕", color: "#f3e8d4" },
  { barcode: "4800888600365", name: "Surf Powder 70g", category: "Household", cost: 13, retailPrice: 17, wholesalePrice: 15, stock: 29, minStock: 10, icon: "🫧", color: "#cffafe" },
  { barcode: "4800888151041", name: "Sunsilk Shampoo Sachet", category: "Personal Care", cost: 5.5, retailPrice: 8, wholesalePrice: 7, stock: 41, minStock: 12, icon: "🧴", color: "#fce7f3" },
  { barcode: "4806504710012", name: "Gardenia Classic Loaf", category: "Groceries", cost: 66, retailPrice: 76, wholesalePrice: 71, stock: 8, minStock: 6, icon: "🍞", color: "#ffedd5" },
];

const allowedPayments = new Set(["Cash", "GCash", "Maya", "Bank Transfer", "Utang"]);
const cashierActions = new Set(["completeSale", "holdOrder", "deleteHeldOrder", "createCustomer", "endShift", "getSaleReceipt"]);
const numberValue = (value: unknown) => Number(value ?? 0);
const textValue = (value: unknown) => String(value ?? "").trim();

async function hashText(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function managerSessionToken(pinHash: string) {
  return hashText(`${pinHash}:swirl-dry-manager-session-v1`);
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

async function hasManagerSession(request: Request, pinHash?: string | null) {
  if (!pinHash) return false;
  return cookieValue(request, "sd_manager_session") === await managerSessionToken(pinHash);
}

function localDate() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function ensureSeeded() {
  const db = await getDb();
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (!existing.length) {
    for (const product of seedProducts) await db.insert(products).values(product).onConflictDoNothing();
  }
  const employee = await db.select({ id: employees.id }).from(employees).limit(1);
  if (!employee.length) await db.insert(employees).values([
    { fullName: "Anna Marquez", role: "Admin Cashier", dailyRate: 650, workDays: 6, storeCredit: 0, status: "Active" },
    { fullName: "Rica Santos", role: "Cashier", dailyRate: 600, workDays: 6, storeCredit: 180, status: "Active" },
  ]);
  const settings = await db.select({ id: storeSettings.id }).from(storeSettings).limit(1);
  if (!settings.length) await db.insert(storeSettings).values({ id: 1 });
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    await ensureSeeded();
    const db = await getDb();
    const url = new URL(request.url);
    const today = localDate();
    const from = url.searchParams.get("from") || today;
    const to = url.searchParams.get("to") || from;
    const range = and(gte(sales.createdAt, `${from} 00:00:00`), lte(sales.createdAt, `${to} 23:59:59`));
    const expenseRange = and(gte(expenses.createdAt, `${from} 00:00:00`), lte(expenses.createdAt, `${to} 23:59:59`));
    const todayRange = and(gte(sales.createdAt, `${today} 00:00:00`), lte(sales.createdAt, `${today} 23:59:59`));

    const [
      productRows, saleRows, expenseRows, supplierRows, customerRows, employeeRows, shiftRows,
      heldRows, customerTransactionRows, supplierTransactionRows, stockRows, settingsRows, todayRows,
    ] = await Promise.all([
      db.select().from(products).where(eq(products.active, true)).orderBy(products.name),
      db.select().from(sales).where(range).orderBy(desc(sales.createdAt)).limit(2000),
      db.select().from(expenses).where(expenseRange).orderBy(desc(expenses.createdAt)).limit(1000),
      db.select().from(suppliers).orderBy(suppliers.name),
      db.select().from(customers).orderBy(customers.name),
      db.select().from(employees).orderBy(employees.fullName),
      db.select().from(shifts).orderBy(desc(shifts.startedAt)).limit(50),
      db.select().from(heldOrders).orderBy(desc(heldOrders.createdAt)).limit(50),
      db.select().from(customerTransactions).orderBy(desc(customerTransactions.createdAt)).limit(500),
      db.select().from(supplierTransactions).orderBy(desc(supplierTransactions.createdAt)).limit(500),
      db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt)).limit(500),
      db.select().from(storeSettings).limit(1),
      db.select({
        count: sql<number>`coalesce(sum(CASE WHEN ${sales.status} = 'Completed' THEN 1 ELSE 0 END), 0)`,
        total: sql<number>`coalesce(sum(CASE WHEN ${sales.status} = 'Completed' THEN ${sales.total} ELSE 0 END), 0)`,
        cash: sql<number>`coalesce(sum(CASE WHEN ${sales.status} = 'Completed' AND ${sales.paymentMethod} = 'Cash' THEN ${sales.total} ELSE 0 END), 0)`,
      }).from(sales).where(todayRange),
    ]);

    return Response.json({
      products: productRows,
      sales: saleRows,
      expenses: expenseRows,
      suppliers: supplierRows,
      customers: customerRows,
      employees: employeeRows,
      shifts: shiftRows,
      heldOrders: heldRows,
      customerTransactions: customerTransactionRows,
      supplierTransactions: supplierTransactionRows,
      stockMovements: stockRows,
      settings: settingsRows[0] ? {
        id: settingsRows[0].id,
        businessName: settingsRows[0].businessName,
        address: settingsRows[0].address,
        receiptFooter: settingsRows[0].receiptFooter,
        autoPrint: settingsRows[0].autoPrint,
        soundEnabled: settingsRows[0].soundEnabled,
        lowStockAlerts: settingsRows[0].lowStockAlerts,
        updatedAt: settingsRows[0].updatedAt,
      } : undefined,
      managerPinConfigured: Boolean(settingsRows[0]?.managerPinHash),
      todaySummary: { count: Number(todayRows[0]?.count ?? 0), total: Number(todayRows[0]?.total ?? 0), cash: Number(todayRows[0]?.cash ?? 0) },
      range: { from, to },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = textValue(payload.action);
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const db = await getDb();

    if (action === "managerLogout") {
      return Response.json({ ok: true }, { headers: { "set-cookie": "sd_manager_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" } });
    }

    if (action === "setManagerPin" || action === "verifyManagerPin") {
      const pin = textValue(data.pin);
      if (!/^\d{4,8}$/.test(pin)) return badRequest("Manager PIN must contain 4 to 8 numbers.");
      const [settings] = await db.select().from(storeSettings).limit(1);
      if (!settings) return badRequest("Store settings are not ready.");
      const pinHash = await hashText(pin);
      if (action === "setManagerPin") {
        const authorized = !settings.managerPinHash || await hasManagerSession(request, settings.managerPinHash);
        if (!authorized) return Response.json({ error: "Manager authorization is required to change the PIN." }, { status: 403 });
        await db.update(storeSettings).set({ managerPinHash: pinHash, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(storeSettings.id, settings.id));
      } else if (!settings.managerPinHash || settings.managerPinHash !== pinHash) {
        return Response.json({ error: "Incorrect manager PIN." }, { status: 401 });
      }
      const session = await managerSessionToken(pinHash);
      return Response.json({ ok: true }, { headers: { "set-cookie": `sd_manager_session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` } });
    }

    if (!cashierActions.has(action)) {
      const [settings] = await db.select({ managerPinHash: storeSettings.managerPinHash }).from(storeSettings).limit(1);
      if (!settings?.managerPinHash || !await hasManagerSession(request, settings.managerPinHash)) {
        return Response.json({ error: "Manager access is required for this action." }, { status: 403 });
      }
    }

    if (action === "getSaleReceipt") {
      const saleId = numberValue(data.saleId);
      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
      if (!sale) return badRequest("Sale not found.");
      const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId)).orderBy(saleItems.id);
      return Response.json({ sale, items });
    }

    if (action === "completeSale") {
      const requestedItems = (data.items ?? []) as Array<{ productId: number; quantity: number }>;
      if (!requestedItems.length) return badRequest("Sale has no items.");
      const priceMode = data.priceMode === "wholesale" ? "wholesale" : "retail";
      const paymentMethod = textValue(data.paymentMethod) || "Cash";
      if (!allowedPayments.has(paymentMethod)) return badRequest("Invalid payment method.");

      const normalizedItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; lineTotal: number }> = [];
      for (const requested of requestedItems) {
        const quantity = Math.floor(numberValue(requested.quantity));
        if (quantity <= 0) return badRequest("Every item must have a valid quantity.");
        const [product] = await db.select().from(products).where(eq(products.id, Number(requested.productId))).limit(1);
        if (!product || !product.active) return badRequest("A product in the cart is no longer available.");
        if (product.stock < quantity) return badRequest(`${product.name} only has ${product.stock} item(s) in stock.`);
        const unitPrice = priceMode === "wholesale" ? product.wholesalePrice : product.retailPrice;
        normalizedItems.push({ productId: product.id, productName: product.name, quantity, unitPrice, lineTotal: unitPrice * quantity });
      }

      const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const discount = Math.min(subtotal, Math.max(0, numberValue(data.discount)));
      const total = subtotal - discount;
      const tendered = numberValue(data.tendered);
      const referenceNo = textValue(data.referenceNo);
      if (paymentMethod === "Cash" && tendered < total) return badRequest("Cash received is less than the amount due.");
      if (["GCash", "Maya", "Bank Transfer"].includes(paymentMethod) && !referenceNo) return badRequest("Reference number is required for digital payments.");

      const customerId = numberValue(data.customerId);
      let customer: typeof customers.$inferSelect | undefined;
      if (customerId) [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (paymentMethod === "Utang") {
        if (!customer) return badRequest("Select a registered customer before charging to utang.");
        if (customer.balance + total > customer.creditLimit) return badRequest(`${customer.name} does not have enough available credit.`);
      }

      const receiptNo = `SD-${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 10)}`;
      const [sale] = await db.insert(sales).values({
        receiptNo,
        customerName: customer?.name || "Walk-in Customer",
        priceMode,
        paymentMethod,
        referenceNo: referenceNo || null,
        subtotal,
        discount,
        total,
        tendered: paymentMethod === "Cash" ? tendered : total,
        changeAmount: paymentMethod === "Cash" ? Math.max(0, tendered - total) : 0,
        itemCount: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
        cashier: textValue(data.cashier) || "Anna Marquez",
        status: "Completed",
      }).returning();

      await db.insert(saleItems).values(normalizedItems.map((item) => ({ saleId: sale.id, ...item })));
      for (const item of normalizedItems) {
        await db.update(products).set({ stock: sql`MAX(0, ${products.stock} - ${item.quantity})`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, item.productId));
        await db.insert(stockMovements).values({ productId: item.productId, type: "Sale", quantity: -item.quantity, referenceNo: receiptNo });
      }
      if (paymentMethod === "Utang" && customer) {
        await db.update(customers).set({ balance: sql`${customers.balance} + ${total}` }).where(eq(customers.id, customer.id));
        await db.insert(customerTransactions).values({ customerId: customer.id, saleId: sale.id, type: "Charge", amount: total, paymentMethod: "Utang", referenceNo: receiptNo, notes: "POS sale" });
      }
      return Response.json({ sale, items: normalizedItems }, { status: 201 });
    }

    if (action === "voidSale") {
      const saleId = numberValue(data.saleId);
      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
      if (!sale) return badRequest("Sale not found.");
      if (sale.status === "Voided") return badRequest("This sale is already voided.");
      const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
      for (const item of items) {
        await db.update(products).set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, item.productId));
        await db.insert(stockMovements).values({ productId: item.productId, type: "Void", quantity: item.quantity, referenceNo: sale.receiptNo });
      }
      const [creditEntry] = await db.select().from(customerTransactions).where(eq(customerTransactions.saleId, saleId)).limit(1);
      if (creditEntry?.type === "Charge") {
        await db.update(customers).set({ balance: sql`MAX(0, ${customers.balance} - ${creditEntry.amount})` }).where(eq(customers.id, creditEntry.customerId));
        await db.insert(customerTransactions).values({ customerId: creditEntry.customerId, saleId, type: "Adjustment", amount: -creditEntry.amount, notes: `Voided ${sale.receiptNo}` });
      }
      await db.update(sales).set({ status: "Voided" }).where(eq(sales.id, saleId));
      return Response.json({ ok: true });
    }

    if (action === "createProduct") {
      const name = textValue(data.name);
      const barcode = textValue(data.barcode);
      const retailPrice = numberValue(data.retailPrice);
      const stock = Math.max(0, Math.floor(numberValue(data.stock)));
      if (!name || !barcode) return badRequest("Product name and barcode are required.");
      if (retailPrice <= 0) return badRequest("Retail price must be greater than zero.");
      const [row] = await db.insert(products).values({
        barcode, name, category: textValue(data.category) || "Others", cost: Math.max(0, numberValue(data.cost)), retailPrice,
        wholesalePrice: Math.max(0, numberValue(data.wholesalePrice) || retailPrice), stock, minStock: Math.max(0, Math.floor(numberValue(data.minStock) || 5)),
        expiryDate: textValue(data.expiryDate) || null, icon: textValue(data.icon) || "📦", color: textValue(data.color) || "#e2e8f0",
      }).returning();
      if (stock) await db.insert(stockMovements).values({ productId: row.id, type: "Opening Stock", quantity: stock, notes: "New product" });
      return Response.json({ product: row }, { status: 201 });
    }

    if (action === "updateProduct") {
      const productId = numberValue(data.productId);
      const [row] = await db.update(products).set({
        barcode: textValue(data.barcode), name: textValue(data.name), category: textValue(data.category) || "Others",
        cost: Math.max(0, numberValue(data.cost)), retailPrice: Math.max(0, numberValue(data.retailPrice)),
        wholesalePrice: Math.max(0, numberValue(data.wholesalePrice)), minStock: Math.max(0, Math.floor(numberValue(data.minStock))),
        expiryDate: textValue(data.expiryDate) || null, updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(products.id, productId)).returning();
      if (!row) return badRequest("Product not found.");
      return Response.json({ product: row });
    }

    if (action === "archiveProduct") {
      const [row] = await db.update(products).set({ active: false, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, numberValue(data.productId))).returning();
      if (!row) return badRequest("Product not found.");
      return Response.json({ product: row });
    }

    if (action === "stockIn") {
      const quantity = Math.floor(numberValue(data.quantity));
      const productId = numberValue(data.productId);
      if (quantity <= 0) return badRequest("Stock-in quantity must be greater than zero.");
      const [row] = await db.update(products).set({ stock: sql`${products.stock} + ${quantity}`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, productId)).returning();
      if (!row) return badRequest("Product not found.");
      await db.insert(stockMovements).values({ productId, type: "Stock In", quantity, referenceNo: textValue(data.referenceNo) || null, notes: textValue(data.notes) });
      return Response.json({ product: row });
    }

    if (action === "createExpense") {
      const amount = numberValue(data.amount);
      if (amount <= 0) return badRequest("Expense amount must be greater than zero.");
      const [row] = await db.insert(expenses).values({ category: textValue(data.category) || "Others", description: textValue(data.description), amount, paymentMethod: textValue(data.paymentMethod) || "Cash", notes: textValue(data.notes) }).returning();
      return Response.json({ expense: row }, { status: 201 });
    }

    if (action === "createSupplier") {
      const name = textValue(data.name);
      if (!name) return badRequest("Supplier name is required.");
      const totalCredit = Math.max(0, numberValue(data.totalCredit));
      const amountPaid = Math.min(totalCredit, Math.max(0, numberValue(data.amountPaid)));
      const dueDate = textValue(data.dueDate) || null;
      const [row] = await db.insert(suppliers).values({ name, contactNo: textValue(data.contactNo), totalCredit, amountPaid, dueDate, notes: textValue(data.notes) }).returning();
      if (totalCredit) await db.insert(supplierTransactions).values({ supplierId: row.id, type: "Invoice", amount: totalCredit, referenceNo: textValue(data.referenceNo) || null, dueDate, notes: "Opening balance" });
      if (amountPaid) await db.insert(supplierTransactions).values({ supplierId: row.id, type: "Payment", amount: amountPaid, notes: "Opening payment" });
      return Response.json({ supplier: row }, { status: 201 });
    }

    if (action === "addSupplierInvoice") {
      const supplierId = numberValue(data.supplierId);
      const amount = numberValue(data.amount);
      if (amount <= 0) return badRequest("Invoice amount must be greater than zero.");
      const dueDate = textValue(data.dueDate) || null;
      const [row] = await db.update(suppliers).set({ totalCredit: sql`${suppliers.totalCredit} + ${amount}`, dueDate: dueDate || undefined }).where(eq(suppliers.id, supplierId)).returning();
      if (!row) return badRequest("Supplier not found.");
      await db.insert(supplierTransactions).values({ supplierId, type: "Invoice", amount, referenceNo: textValue(data.referenceNo) || null, dueDate, notes: textValue(data.notes) });
      return Response.json({ supplier: row });
    }

    if (action === "recordSupplierPayment") {
      const supplierId = numberValue(data.supplierId);
      const amount = numberValue(data.amount);
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (!supplier) return badRequest("Supplier not found.");
      const balance = Math.max(0, supplier.totalCredit - supplier.amountPaid);
      if (amount <= 0 || amount > balance) return badRequest(`Payment must be between ₱0.01 and ₱${balance.toFixed(2)}.`);
      await db.update(suppliers).set({ amountPaid: sql`${suppliers.amountPaid} + ${amount}` }).where(eq(suppliers.id, supplierId));
      await db.insert(supplierTransactions).values({ supplierId, type: "Payment", amount, referenceNo: textValue(data.referenceNo) || null, notes: textValue(data.notes) });
      return Response.json({ ok: true });
    }

    if (action === "createCustomer") {
      const name = textValue(data.name);
      if (!name) return badRequest("Customer name is required.");
      const balance = Math.max(0, numberValue(data.balance));
      const creditLimit = Math.max(balance, numberValue(data.creditLimit));
      const [row] = await db.insert(customers).values({ name, contactNo: textValue(data.contactNo), creditLimit, balance, notes: textValue(data.notes) }).returning();
      if (balance) await db.insert(customerTransactions).values({ customerId: row.id, type: "Charge", amount: balance, notes: "Opening balance" });
      return Response.json({ customer: row }, { status: 201 });
    }

    if (action === "recordCustomerPayment") {
      const customerId = numberValue(data.customerId);
      const amount = numberValue(data.amount);
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!customer) return badRequest("Customer not found.");
      if (amount <= 0 || amount > customer.balance) return badRequest(`Payment must be between ₱0.01 and ₱${customer.balance.toFixed(2)}.`);
      await db.update(customers).set({ balance: sql`MAX(0, ${customers.balance} - ${amount})` }).where(eq(customers.id, customerId));
      await db.insert(customerTransactions).values({ customerId, type: "Payment", amount, paymentMethod: textValue(data.paymentMethod) || "Cash", referenceNo: textValue(data.referenceNo) || null, notes: textValue(data.notes) });
      return Response.json({ ok: true });
    }

    if (action === "createEmployee") {
      const fullName = textValue(data.fullName);
      if (!fullName) return badRequest("Employee name is required.");
      const [row] = await db.insert(employees).values({ fullName, role: textValue(data.role) || "Staff", dailyRate: Math.max(0, numberValue(data.dailyRate)), workDays: Math.max(0, numberValue(data.workDays)), storeCredit: Math.max(0, numberValue(data.storeCredit)), status: textValue(data.status) || "Active" }).returning();
      return Response.json({ employee: row }, { status: 201 });
    }

    if (action === "updateEmployee") {
      const [row] = await db.update(employees).set({ fullName: textValue(data.fullName), role: textValue(data.role) || "Staff", dailyRate: Math.max(0, numberValue(data.dailyRate)), workDays: Math.max(0, numberValue(data.workDays)), storeCredit: Math.max(0, numberValue(data.storeCredit)), status: textValue(data.status) || "Active" }).where(eq(employees.id, numberValue(data.employeeId))).returning();
      if (!row) return badRequest("Employee not found.");
      return Response.json({ employee: row });
    }

    if (action === "holdOrder") {
      const cartJson = textValue(data.cartJson);
      if (!cartJson || cartJson === "[]") return badRequest("There are no items to hold.");
      const [row] = await db.insert(heldOrders).values({ label: textValue(data.label) || `Held Order ${new Date().toLocaleTimeString("en-PH")}`, customerId: numberValue(data.customerId) || null, priceMode: data.priceMode === "wholesale" ? "wholesale" : "retail", discount: Math.max(0, numberValue(data.discount)), cartJson }).returning();
      return Response.json({ heldOrder: row }, { status: 201 });
    }

    if (action === "deleteHeldOrder") {
      await db.delete(heldOrders).where(eq(heldOrders.id, numberValue(data.heldOrderId)));
      return Response.json({ ok: true });
    }

    if (action === "endShift") {
      const closingCash = numberValue(data.closingCash);
      const expectedCash = numberValue(data.expectedCash);
      const [row] = await db.insert(shifts).values({ cashier: textValue(data.cashier) || "Anna Marquez", openingCash: Math.max(0, numberValue(data.openingCash)), expectedCash, closingCash, variance: closingCash - expectedCash, status: "Closed", endedAt: sql`CURRENT_TIMESTAMP` }).returning();
      return Response.json({ shift: row }, { status: 201 });
    }

    if (action === "updateSettings") {
      const [row] = await db.update(storeSettings).set({ businessName: textValue(data.businessName) || "SWIRL-DRY AND SARI-SARI STORE", address: textValue(data.address), receiptFooter: textValue(data.receiptFooter), autoPrint: Boolean(data.autoPrint), soundEnabled: Boolean(data.soundEnabled), lowStockAlerts: Boolean(data.lowStockAlerts), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(storeSettings.id, 1)).returning();
      return Response.json({ settings: row });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message.includes("UNIQUE constraint failed: products.barcode")) return badRequest("That barcode is already assigned to another product.");
    return errorResponse(error);
  }
}
