import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warrantiesTable = pgTable("warranties", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(1),
  productName: text("product_name").notNull(),
  merchantName: text("merchant_name"),
  purchaseDate: text("purchase_date").notNull(),
  warrantyEndDate: text("warranty_end_date").notNull(),
  reminderEnabled: boolean("reminder_enabled").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWarrantySchema = createInsertSchema(warrantiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWarranty = z.infer<typeof insertWarrantySchema>;
export type Warranty = typeof warrantiesTable.$inferSelect;
