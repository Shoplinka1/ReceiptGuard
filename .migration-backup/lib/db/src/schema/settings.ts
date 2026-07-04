import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().default(1),
  theme: text("theme").notNull().default("dark"),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("America/New_York"),
  language: text("language").notNull().default("en"),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  browserNotifications: boolean("browser_notifications").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({ id: true, updatedAt: true });
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettingsTable.$inferSelect;

export const reminderSettingsTable = pgTable("reminder_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().default(1),
  renewalReminder: boolean("renewal_reminder").notNull().default(true),
  warrantyReminder: boolean("warranty_reminder").notNull().default(true),
  returnWindowReminder: boolean("return_window_reminder").notNull().default(false),
  daysBefore30: boolean("days_before_30").notNull().default(true),
  daysBefore14: boolean("days_before_14").notNull().default(true),
  daysBefore7: boolean("days_before_7").notNull().default(true),
  daysBefore3: boolean("days_before_3").notNull().default(false),
  daysBefore1: boolean("days_before_1").notNull().default(false),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  browserNotifications: boolean("browser_notifications").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReminderSettingsSchema = createInsertSchema(reminderSettingsTable).omit({ id: true, updatedAt: true });
export type InsertReminderSettings = z.infer<typeof insertReminderSettingsSchema>;
export type ReminderSettings = typeof reminderSettingsTable.$inferSelect;
