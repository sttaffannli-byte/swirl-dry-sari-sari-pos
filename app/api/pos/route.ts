import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customers, employees, expenses, products, saleItems, sales, shifts, suppliers } from "../../../db/schema";

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

async function ensureSeeded() {
  const db = await getDb();
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (!existing.length) await db.insert(products).values(seedProducts);
  const employee = await db.select({ id: employees.id }).from(employees).limit(1);
  if (!employee.length) await db.insert(employees).values([
    { fullName: "Anna Marquez", role: "Admin Cashier", dailyRate: 650, workDays: 6, storeCredit: 0, status: "Active" },
    { fullName: "Rica Santos", role: "Cashier", dailyRate: 600, workDays: 6, storeCredit: 180, status: "Active" },
  ]);
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    await ensureSeeded();
    const db = await getDb();
    const [productRows, saleRows, expenseRows, supplierRows, customerRows, employeeRows, shiftRows] = await Promise.all([
      db.select().from(products).where(eq(products.active, true)).orderBy(products.name),
      db.select().from(sales).orderBy(desc(sales.createdAt)).limit(100),
      db.select().from(expenses).orderBy(desc(expenses.createdAt)).limit(100),
      db.select().from(suppliers).orderBy(suppliers.name),
      db.select().from(customers).orderBy(customers.name),
      db.select().from(employees).orderBy(employees.fullName),
      db.select().from(shifts).orderBy(desc(shifts.startedAt)).limit(20),
    ]);
    return Response.json({ products: productRows, sales: saleRows, expenses: expenseRows, suppliers: supplierRows, customers: customerRows, employees: employeeRows, shifts: shiftRows });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action ?? "");
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const db = await getDb();

    if (action === "completeSale") {
      const items = (data.items ?? []) as Array<{ productId: number; productName: string; quantity: number; unitPrice: number; lineTotal: number }>;
      if (!items.length) return Response.json({ error: "Sale has no items" }, { status: 400 });
      const receiptNo = `SD-${Date.now().toString().slice(-10)}`;
      const [sale] = await db.insert(sales).values({
        receiptNo,
        customerName: String(data.customerName ?? "Walk-in Customer"),
        priceMode: String(data.priceMode ?? "retail"),
        paymentMethod: String(data.paymentMethod ?? "Cash"),
        referenceNo: data.referenceNo ? String(data.referenceNo) : null,
        subtotal: Number(data.subtotal ?? 0), discount: Number(data.discount ?? 0), total: Number(data.total ?? 0),
        tendered: Number(data.tendered ?? 0), changeAmount: Number(data.changeAmount ?? 0),
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0), cashier: String(data.cashier ?? "Anna Marquez"),
      }).returning();
      await db.insert(saleItems).values(items.map((item) => ({ saleId: sale.id, ...item })));
      for (const item of items) await db.update(products).set({ stock: sql`MAX(0, ${products.stock} - ${item.quantity})`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, item.productId));
      return Response.json({ sale }, { status: 201 });
    }

    if (action === "createProduct") {
      const [row] = await db.insert(products).values({
        barcode: String(data.barcode ?? Date.now()), name: String(data.name ?? "New Product"), category: String(data.category ?? "Others"),
        cost: Number(data.cost ?? 0), retailPrice: Number(data.retailPrice ?? 0), wholesalePrice: Number(data.wholesalePrice ?? data.retailPrice ?? 0),
        stock: Number(data.stock ?? 0), minStock: Number(data.minStock ?? 5), expiryDate: data.expiryDate ? String(data.expiryDate) : null,
        icon: String(data.icon ?? "📦"), color: String(data.color ?? "#e2e8f0"),
      }).returning();
      return Response.json({ product: row }, { status: 201 });
    }
    if (action === "stockIn") {
      const [row] = await db.update(products).set({ stock: sql`${products.stock} + ${Number(data.quantity ?? 0)}`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, Number(data.productId))).returning();
      return Response.json({ product: row });
    }
    if (action === "createExpense") {
      const [row] = await db.insert(expenses).values({ category: String(data.category ?? "Others"), description: String(data.description ?? ""), amount: Number(data.amount ?? 0), paymentMethod: String(data.paymentMethod ?? "Cash"), notes: String(data.notes ?? "") }).returning();
      return Response.json({ expense: row }, { status: 201 });
    }
    if (action === "createSupplier") {
      const [row] = await db.insert(suppliers).values({ name: String(data.name ?? ""), contactNo: String(data.contactNo ?? ""), totalCredit: Number(data.totalCredit ?? 0), amountPaid: Number(data.amountPaid ?? 0), dueDate: data.dueDate ? String(data.dueDate) : null, notes: String(data.notes ?? "") }).returning();
      return Response.json({ supplier: row }, { status: 201 });
    }
    if (action === "createCustomer") {
      const [row] = await db.insert(customers).values({ name: String(data.name ?? ""), contactNo: String(data.contactNo ?? ""), creditLimit: Number(data.creditLimit ?? 0), balance: Number(data.balance ?? 0), notes: String(data.notes ?? "") }).returning();
      return Response.json({ customer: row }, { status: 201 });
    }
    if (action === "createEmployee") {
      const [row] = await db.insert(employees).values({ fullName: String(data.fullName ?? ""), role: String(data.role ?? "Staff"), dailyRate: Number(data.dailyRate ?? 0), workDays: Number(data.workDays ?? 0), storeCredit: Number(data.storeCredit ?? 0), status: String(data.status ?? "Active") }).returning();
      return Response.json({ employee: row }, { status: 201 });
    }
    if (action === "endShift") {
      const closingCash = Number(data.closingCash ?? 0); const expectedCash = Number(data.expectedCash ?? 0);
      const [row] = await db.insert(shifts).values({ cashier: String(data.cashier ?? "Anna Marquez"), openingCash: Number(data.openingCash ?? 0), expectedCash, closingCash, variance: closingCash - expectedCash, status: "Closed", endedAt: sql`CURRENT_TIMESTAMP` }).returning();
      return Response.json({ shift: row }, { status: 201 });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}
