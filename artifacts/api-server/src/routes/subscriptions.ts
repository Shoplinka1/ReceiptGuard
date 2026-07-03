import { Router, type IRouter } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq, sql, and, asc, desc } from "drizzle-orm";
import {
  CreateSubscriptionBody,
  GetSubscriptionParams,
  UpdateSubscriptionParams,
  UpdateSubscriptionBody,
  DeleteSubscriptionParams,
  ListSubscriptionsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapSub(s: typeof subscriptionsTable.$inferSelect) {
  return {
    id: s.id,
    companyName: s.companyName,
    companyLogoUrl: s.companyLogoUrl ?? null,
    monthlyPrice: parseFloat(s.monthlyPrice),
    yearlyPrice: s.yearlyPrice ? parseFloat(s.yearlyPrice) : null,
    billingCycle: s.billingCycle as "monthly" | "yearly" | "quarterly",
    renewalDate: s.renewalDate,
    status: s.status as "active" | "cancelled" | "paused" | "trial",
    category: s.category,
    reminderEnabled: s.reminderEnabled,
    notes: s.notes ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/subscriptions", async (req, res): Promise<void> => {
  const params = ListSubscriptionsQueryParams.safeParse(req.query);
  const userId = 1;

  let subs = await db.select().from(subscriptionsTable).where(sql`${subscriptionsTable.userId} = ${userId}`);

  if (params.success) {
    const { search, status, category, billingCycle } = params.data;
    if (search) subs = subs.filter((s) => s.companyName.toLowerCase().includes(search.toLowerCase()));
    if (status) subs = subs.filter((s) => s.status === status);
    if (category) subs = subs.filter((s) => s.category === category);
    if (billingCycle) subs = subs.filter((s) => s.billingCycle === billingCycle);

    const sortBy = params.data.sortBy ?? "renewalDate";
    const sortDir = params.data.sortDir ?? "asc";

    subs.sort((a, b) => {
      let aVal: string | number = a[sortBy as keyof typeof a] as string | number ?? "";
      let bVal: string | number = b[sortBy as keyof typeof b] as string | number ?? "";
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  res.json(subs.map(mapSub));
});

router.post("/subscriptions", async (req, res): Promise<void> => {
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [s] = await db.insert(subscriptionsTable).values({
    userId: 1,
    companyName: parsed.data.companyName,
    companyLogoUrl: parsed.data.companyLogoUrl ?? null,
    monthlyPrice: String(parsed.data.monthlyPrice),
    yearlyPrice: parsed.data.yearlyPrice != null ? String(parsed.data.yearlyPrice) : null,
    billingCycle: parsed.data.billingCycle ?? "monthly",
    renewalDate: parsed.data.renewalDate,
    status: parsed.data.status ?? "active",
    category: parsed.data.category,
    reminderEnabled: parsed.data.reminderEnabled ?? true,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(mapSub(s));
});

router.get("/subscriptions/breakdown", async (req, res): Promise<void> => {
  const userId = 1;
  const subs = await db.select().from(subscriptionsTable).where(
    and(sql`${subscriptionsTable.userId} = ${userId}`, sql`${subscriptionsTable.status} = 'active'`)
  );

  const monthly = subs.filter((s) => s.billingCycle === "monthly");
  const yearly = subs.filter((s) => s.billingCycle === "yearly");
  const monthlyTotal = monthly.reduce((sum, s) => sum + parseFloat(s.monthlyPrice), 0);
  const yearlyTotal = yearly.reduce((sum, s) => sum + (s.yearlyPrice ? parseFloat(s.yearlyPrice) : parseFloat(s.monthlyPrice) * 12), 0);
  const grandMonthlyEquivalent = monthlyTotal + yearlyTotal / 12;

  const catMap = new Map<string, { total: number; count: number }>();
  for (const s of subs) {
    const price = s.billingCycle === "yearly" && s.yearlyPrice
      ? parseFloat(s.yearlyPrice) / 12
      : parseFloat(s.monthlyPrice);
    const ex = catMap.get(s.category);
    if (ex) { ex.total += price; ex.count++; }
    else catMap.set(s.category, { total: price, count: 1 });
  }

  res.json({
    monthlyCount: monthly.length,
    yearlyCount: yearly.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    grandMonthlyEquivalent: Math.round(grandMonthlyEquivalent * 100) / 100,
    categoryBreakdown: Array.from(catMap.entries()).map(([category, v]) => ({
      category,
      total: Math.round(v.total * 100) / 100,
      count: v.count,
    })),
  });
});

router.get("/subscriptions/:id", async (req, res): Promise<void> => {
  const params = GetSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [s] = await db.select().from(subscriptionsTable).where(and(eq(subscriptionsTable.id, params.data.id), sql`${subscriptionsTable.userId} = 1`));
  if (!s) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.json(mapSub(s));
});

router.patch("/subscriptions/:id", async (req, res): Promise<void> => {
  const params = UpdateSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateSubscriptionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: Partial<typeof subscriptionsTable.$inferInsert> = {};
  if (body.data.companyName != null) updates.companyName = body.data.companyName;
  if (body.data.monthlyPrice != null) updates.monthlyPrice = String(body.data.monthlyPrice);
  if (body.data.yearlyPrice != null) updates.yearlyPrice = String(body.data.yearlyPrice);
  if (body.data.billingCycle != null) updates.billingCycle = body.data.billingCycle;
  if (body.data.renewalDate != null) updates.renewalDate = body.data.renewalDate;
  if (body.data.status != null) updates.status = body.data.status;
  if (body.data.category != null) updates.category = body.data.category;
  if (body.data.reminderEnabled != null) updates.reminderEnabled = body.data.reminderEnabled;
  if (body.data.notes != null) updates.notes = body.data.notes;

  const [s] = await db.update(subscriptionsTable).set(updates).where(and(eq(subscriptionsTable.id, params.data.id), sql`${subscriptionsTable.userId} = 1`)).returning();
  if (!s) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.json(mapSub(s));
});

router.delete("/subscriptions/:id", async (req, res): Promise<void> => {
  const params = DeleteSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [s] = await db.delete(subscriptionsTable).where(and(eq(subscriptionsTable.id, params.data.id), sql`${subscriptionsTable.userId} = 1`)).returning();
  if (!s) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.sendStatus(204);
});

export default router;
