import { Router, type IRouter } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq, sql, gte, lte, and } from "drizzle-orm";
import {
  UpdateRenewalParams,
  UpdateRenewalBody,
  ListRenewalsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/renewals", async (req, res): Promise<void> => {
  const params = ListRenewalsQueryParams.safeParse(req.query);
  const userId = 1;
  const now = new Date();

  let from: string;
  let to: string;

  if (params.success && params.data.period) {
    switch (params.data.period) {
      case "today":
        from = to = now.toISOString().split("T")[0];
        break;
      case "this_week": {
        const day = now.getDay();
        const start = new Date(now); start.setDate(now.getDate() - day);
        const end = new Date(now); end.setDate(now.getDate() + (6 - day));
        from = start.toISOString().split("T")[0];
        to = end.toISOString().split("T")[0];
        break;
      }
      case "this_month":
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
        break;
      case "next_month":
        from = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];
        to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];
        break;
      default:
        from = now.toISOString().split("T")[0];
        to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    }
  } else if (params.success && params.data.month && params.data.year) {
    const y = params.data.year;
    const m = params.data.month;
    from = `${y}-${String(m).padStart(2, "0")}-01`;
    to = new Date(y, m, 0).toISOString().split("T")[0];
  } else {
    from = now.toISOString().split("T")[0];
    to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }

  const subs = await db.select().from(subscriptionsTable).where(
    and(
      sql`${subscriptionsTable.userId} = ${userId}`,
      sql`${subscriptionsTable.status} = 'active'`,
      gte(subscriptionsTable.renewalDate, from),
      lte(subscriptionsTable.renewalDate, to)
    )
  );

  const renewals = subs.map((s, i) => {
    const renewDate = new Date(s.renewalDate);
    const daysUntil = Math.ceil((renewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: i + 1,
      subscriptionId: s.id,
      companyName: s.companyName,
      companyLogoUrl: s.companyLogoUrl ?? null,
      amount: parseFloat(s.monthlyPrice),
      renewalDate: s.renewalDate,
      daysUntilRenewal: Math.max(0, daysUntil),
      reminderEnabled: s.reminderEnabled,
      reminderDaysBefore: 7,
    };
  });

  res.json(renewals);
});

router.patch("/renewals/:id", async (req, res): Promise<void> => {
  const params = UpdateRenewalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateRenewalBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  // Renewals are derived from subscriptions; update reminderEnabled on the subscription
  const subs = await db.select().from(subscriptionsTable).where(sql`${subscriptionsTable.userId} = 1`);
  const sub = subs[params.data.id - 1]; // id is index-based
  if (!sub) { res.status(404).json({ error: "Renewal not found" }); return; }

  if (body.data.reminderEnabled != null) {
    await db.update(subscriptionsTable).set({ reminderEnabled: body.data.reminderEnabled }).where(eq(subscriptionsTable.id, sub.id));
  }

  const now = new Date();
  const renewDate = new Date(sub.renewalDate);
  const daysUntil = Math.ceil((renewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    id: params.data.id,
    subscriptionId: sub.id,
    companyName: sub.companyName,
    companyLogoUrl: sub.companyLogoUrl ?? null,
    amount: parseFloat(sub.monthlyPrice),
    renewalDate: sub.renewalDate,
    daysUntilRenewal: Math.max(0, daysUntil),
    reminderEnabled: body.data.reminderEnabled ?? sub.reminderEnabled,
    reminderDaysBefore: body.data.reminderDaysBefore ?? 7,
  });
});

export default router;
