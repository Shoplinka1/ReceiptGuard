import { Router, type IRouter } from "express";
import { db, usersTable, userSettingsTable, reminderSettingsTable, activityLogsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import {
  UpdateUserProfileBody,
  UpdateUserSettingsBody,
  UpdateReminderSettingsBody,
  TriggerGmailScanBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_USER_ID = 1;

async function ensureUser() {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, DEFAULT_USER_ID));
  if (!user) {
    const [newUser] = await db.insert(usersTable).values({
      id: DEFAULT_USER_ID,
      name: "Alex Johnson",
      email: "alex@example.com",
      plan: "free",
      gmailConnected: false,
      storageUsed: 0,
    }).returning();
    return newUser;
  }
  return user;
}

async function ensureSettings() {
  const [s] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, DEFAULT_USER_ID));
  if (!s) {
    const [ns] = await db.insert(userSettingsTable).values({ userId: DEFAULT_USER_ID }).returning();
    return ns;
  }
  return s;
}

async function ensureReminderSettings() {
  const [r] = await db.select().from(reminderSettingsTable).where(eq(reminderSettingsTable.userId, DEFAULT_USER_ID));
  if (!r) {
    const [nr] = await db.insert(reminderSettingsTable).values({ userId: DEFAULT_USER_ID }).returning();
    return nr;
  }
  return r;
}

router.get("/user/profile", async (req, res): Promise<void> => {
  const user = await ensureUser();
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    plan: user.plan as "free" | "pro",
    gmailConnected: user.gmailConnected,
    gmailEmail: user.gmailEmail ?? null,
    storageUsed: user.storageUsed,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/user/profile", async (req, res): Promise<void> => {
  const body = UpdateUserProfileBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  await ensureUser();

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (body.data.name != null) updates.name = body.data.name;
  if (body.data.avatarUrl != null) updates.avatarUrl = body.data.avatarUrl;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, DEFAULT_USER_ID)).returning();
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    plan: user.plan as "free" | "pro",
    gmailConnected: user.gmailConnected,
    gmailEmail: user.gmailEmail ?? null,
    storageUsed: user.storageUsed,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/user/settings", async (req, res): Promise<void> => {
  const s = await ensureSettings();
  res.json({
    id: s.id,
    userId: s.userId,
    theme: s.theme as "light" | "dark" | "system",
    currency: s.currency,
    timezone: s.timezone,
    language: s.language,
    emailNotifications: s.emailNotifications,
    browserNotifications: s.browserNotifications,
  });
});

router.patch("/user/settings", async (req, res): Promise<void> => {
  const body = UpdateUserSettingsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await ensureSettings();

  const updates: Partial<typeof userSettingsTable.$inferInsert> = {};
  if (body.data.theme != null) updates.theme = body.data.theme;
  if (body.data.currency != null) updates.currency = body.data.currency;
  if (body.data.timezone != null) updates.timezone = body.data.timezone;
  if (body.data.language != null) updates.language = body.data.language;
  if (body.data.emailNotifications != null) updates.emailNotifications = body.data.emailNotifications;
  if (body.data.browserNotifications != null) updates.browserNotifications = body.data.browserNotifications;

  const [s] = await db.update(userSettingsTable).set(updates).where(eq(userSettingsTable.userId, DEFAULT_USER_ID)).returning();
  res.json({
    id: s.id,
    userId: s.userId,
    theme: s.theme as "light" | "dark" | "system",
    currency: s.currency,
    timezone: s.timezone,
    language: s.language,
    emailNotifications: s.emailNotifications,
    browserNotifications: s.browserNotifications,
  });
});

router.get("/reminders/settings", async (req, res): Promise<void> => {
  const r = await ensureReminderSettings();
  res.json({
    id: r.id,
    userId: r.userId,
    renewalReminder: r.renewalReminder,
    warrantyReminder: r.warrantyReminder,
    returnWindowReminder: r.returnWindowReminder,
    daysBefore30: r.daysBefore30,
    daysBefore14: r.daysBefore14,
    daysBefore7: r.daysBefore7,
    daysBefore3: r.daysBefore3,
    daysBefore1: r.daysBefore1,
    emailNotifications: r.emailNotifications,
    browserNotifications: r.browserNotifications,
  });
});

router.patch("/reminders/settings", async (req, res): Promise<void> => {
  const body = UpdateReminderSettingsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await ensureReminderSettings();

  const updates: Partial<typeof reminderSettingsTable.$inferInsert> = {};
  const d = body.data;
  if (d.renewalReminder != null) updates.renewalReminder = d.renewalReminder;
  if (d.warrantyReminder != null) updates.warrantyReminder = d.warrantyReminder;
  if (d.returnWindowReminder != null) updates.returnWindowReminder = d.returnWindowReminder;
  if (d.daysBefore30 != null) updates.daysBefore30 = d.daysBefore30;
  if (d.daysBefore14 != null) updates.daysBefore14 = d.daysBefore14;
  if (d.daysBefore7 != null) updates.daysBefore7 = d.daysBefore7;
  if (d.daysBefore3 != null) updates.daysBefore3 = d.daysBefore3;
  if (d.daysBefore1 != null) updates.daysBefore1 = d.daysBefore1;
  if (d.emailNotifications != null) updates.emailNotifications = d.emailNotifications;
  if (d.browserNotifications != null) updates.browserNotifications = d.browserNotifications;

  const [r] = await db.update(reminderSettingsTable).set(updates).where(eq(reminderSettingsTable.userId, DEFAULT_USER_ID)).returning();
  res.json({
    id: r.id,
    userId: r.userId,
    renewalReminder: r.renewalReminder,
    warrantyReminder: r.warrantyReminder,
    returnWindowReminder: r.returnWindowReminder,
    daysBefore30: r.daysBefore30,
    daysBefore14: r.daysBefore14,
    daysBefore7: r.daysBefore7,
    daysBefore3: r.daysBefore3,
    daysBefore1: r.daysBefore1,
    emailNotifications: r.emailNotifications,
    browserNotifications: r.browserNotifications,
  });
});

router.post("/gmail/scan", async (req, res): Promise<void> => {
  const body = TriggerGmailScanBody.safeParse(req.body);

  // Mark gmail as connected
  await ensureUser();
  await db.update(usersTable).set({ gmailConnected: true, gmailEmail: "alex@gmail.com" }).where(eq(usersTable.id, DEFAULT_USER_ID));

  // Log activity
  await db.insert(activityLogsTable).values({
    userId: DEFAULT_USER_ID,
    type: "inbox_scanned",
    description: "Gmail inbox scanned — 8 receipts and 3 subscriptions detected",
    metadata: JSON.stringify({ receiptsFound: 8, subscriptionsFound: 3 }),
  });

  res.json({
    status: "completed",
    receiptsFound: 8,
    subscriptionsFound: 3,
    message: "Scan complete. Found 8 receipts and 3 subscriptions.",
  });
});

export default router;
