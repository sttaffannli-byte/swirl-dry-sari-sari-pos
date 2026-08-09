import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
}, (table) => [
  index("products_name_idx").on(table.name),
  index("products_category_idx").on(table.category),
]);

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
  status: text("status").notNull().default("Completed"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("sales_created_at_idx").on(table.createdAt),
  index("sales_payment_method_idx").on(table.paymentMethod),
]);

export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  productId: integer("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  lineTotal: real("line_total").notNull(),
}, (table) => [index("sale_items_sale_id_idx").on(table.saleId)]);

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("expenses_created_at_idx").on(table.createdAt)]);

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
}, (table) => [index("shifts_started_at_idx").on(table.startedAt)]);

export const customerTransactions = sqliteTable("customer_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  saleId: integer("sale_id").references(() => sales.id),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  referenceNo: text("reference_no"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("customer_transactions_customer_idx").on(table.customerId),
  index("customer_transactions_created_at_idx").on(table.createdAt),
]);

export const supplierTransactions = sqliteTable("supplier_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  referenceNo: text("reference_no"),
  dueDate: text("due_date"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("supplier_transactions_supplier_idx").on(table.supplierId),
  index("supplier_transactions_created_at_idx").on(table.createdAt),
]);

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  referenceNo: text("reference_no"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("stock_movements_product_idx").on(table.productId),
  index("stock_movements_created_at_idx").on(table.createdAt),
]);

export const heldOrders = sqliteTable("held_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  priceMode: text("price_mode").notNull().default("retail"),
  discount: real("discount").notNull().default(0),
  cartJson: text("cart_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("held_orders_created_at_idx").on(table.createdAt)]);

export const storeSettings = sqliteTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  businessName: text("business_name").notNull().default("SWIRL-DRY AND SARI-SARI STORE"),
  address: text("address").notNull().default("Buting, Pasig City"),
  receiptFooter: text("receipt_footer").notNull().default("Maraming salamat po! Please come again."),
  autoPrint: integer("auto_print", { mode: "boolean" }).notNull().default(false),
  soundEnabled: integer("sound_enabled", { mode: "boolean" }).notNull().default(true),
  lowStockAlerts: integer("low_stock_alerts", { mode: "boolean" }).notNull().default(true),
  managerPinHash: text("manager_pin_hash"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
