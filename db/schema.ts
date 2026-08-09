import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  barcode: text("barcode").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  cost: real("cost").notNull().default(0),
  retailPrice: real("retail_price").notNull(),
  wholesalePrice: real("wholesale_price").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  expiryDate: text("expiry_date"),
  icon: text("icon").notNull().default("📦"),
  color: text("color").notNull().default("#e2e8f0"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receiptNo: text("receipt_no").notNull().unique(),
  customerName: text("customer_name").notNull().default("Walk-in Customer"),
  priceMode: text("price_mode").notNull().default("retail"),
  paymentMethod: text("payment_method").notNull(),
  referenceNo: text("reference_no"),
  subtotal: real("subtotal").notNull(),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull(),
  tendered: real("tendered").notNull().default(0),
  changeAmount: real("change_amount").notNull().default(0),
  itemCount: integer("item_count").notNull(),
  cashier: text("cashier").notNull().default("Anna Marquez"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  productId: integer("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  lineTotal: real("line_total").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactNo: text("contact_no").notNull().default(""),
  totalCredit: real("total_credit").notNull().default(0),
  amountPaid: real("amount_paid").notNull().default(0),
  dueDate: text("due_date"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactNo: text("contact_no").notNull().default(""),
  creditLimit: real("credit_limit").notNull().default(0),
  balance: real("balance").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  dailyRate: real("daily_rate").notNull().default(0),
  workDays: real("work_days").notNull().default(0),
  storeCredit: real("store_credit").notNull().default(0),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cashier: text("cashier").notNull(),
  openingCash: real("opening_cash").notNull().default(0),
  expectedCash: real("expected_cash").notNull().default(0),
  closingCash: real("closing_cash").notNull().default(0),
  variance: real("variance").notNull().default(0),
  status: text("status").notNull().default("Open"),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  endedAt: text("ended_at"),
});
