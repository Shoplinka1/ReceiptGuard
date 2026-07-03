import { Router, type IRouter } from "express";
import { db, receiptsTable, subscriptionsTable, warrantiesTable, activityLogsTable, usersTable } from "@workspace/db";
import { sql, gte, lte, and } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetSpendingTrendResponse,
  GetTopMerchantsResponse,
  GetUpcomingRenewalsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = 1;

  const [user] = await db.select().from(usersTable).where(sql`${usersTable.id} = ${userId}`);

  const receipts = await db.select().from(receiptsTable).where(sql`${receiptsTable.userId} = ${userId}`);
  const subs = await db.select().from(subscriptionsTable).where(
    and(sql`${subscriptionsTable.userId} = ${userId}`, sql`${subscriptionsTable.status} = 'active'`)
  );

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const monthlyReceipts = receipts.filter(
    (r) => r.purchaseDate >= firstOfMonth && r.purchaseDate <= lastOfMonth
  );
  const monthlySpending = monthlyReceipts.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  const warranties = await db.select().from(warrantiesTable).where(sql`${warrantiesTable.userId} = ${userId}`);
  const today = now.toISOString().split("T")[0];
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const activeWarranties = warranties.filter((w) => w.warrantyEndDate >= today);
  const upcomingRenewals = subs.filter((s) => s.renewalDate >= today && s.renewalDate <= thirtyDaysLater);

  const monthlySubTotal = subs.reduce((sum, s) => {
    if (s.billingCycle === "yearly" && s.yearlyPrice) return sum + parseFloat(s.yearlyPrice) / 12;
    return sum + parseFloat(s.monthlyPrice);
  }, 0);

  const summary = {
    firstName: user?.name?.split(" ")[0] ?? "Alex",
    monthlySpending: Math.round(monthlySpending * 100) / 100,
    totalReceipts: receipts.length,
    activeSubscriptions: subs.length,
    upcomingRenewalsCount: upcomingRenewals.length,
    activeWarranties: activeWarranties.length,
    moneySaved: Math.round(monthlySubTotal * 0.12 * 100) / 100,
    subscriptionsMonthlyTotal: Math.round(monthlySubTotal * 100) / 100,
    gmailConnected: user?.gmailConnected ?? false,
    plan: (user?.plan as "free" | "pro") ?? "free",
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/spending-trend", async (req, res): Promise<void> => {
  const userId = 1;
  const receipts = await db.select().from(receiptsTable).where(sql`${receiptsTable.userId} = ${userId}`);

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthStr = String(month).padStart(2, "0");
    const firstDay = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${monthStr}-${String(lastDay.getDate()).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });

    const total = receipts
      .filter((r) => r.purchaseDate >= firstDay && r.purchaseDate <= lastDayStr)
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    const prevD = new Date(year, month - 2, 1);
    const prevYear = prevD.getFullYear();
    const prevMonth = prevD.getMonth() + 1;
    const prevMonthStr = String(prevMonth).padStart(2, "0");
    const prevFirstDay = `${prevYear}-${prevMonthStr}-01`;
    const prevLastDay = new Date(prevYear, prevMonth, 0);
    const prevLastDayStr = `${prevYear}-${prevMonthStr}-${String(prevLastDay.getDate()).padStart(2, "0")}`;

    const previousTotal = receipts
      .filter((r) => r.purchaseDate >= prevFirstDay && r.purchaseDate <= prevLastDayStr)
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    months.push({ month, year, label, total: Math.round(total * 100) / 100, previousTotal: Math.round(previousTotal * 100) / 100 });
  }

  res.json(GetSpendingTrendResponse.parse(months));
});

router.get("/dashboard/top-merchants", async (req, res): Promise<void> => {
  const userId = 1;
  const receipts = await db.select().from(receiptsTable).where(sql`${receiptsTable.userId} = ${userId}`);

  const merchantMap = new Map<string, { name: string; logoUrl: string | null; totalSpent: number; count: number; lastDate: string }>();
  for (const r of receipts) {
    const existing = merchantMap.get(r.merchantName);
    if (existing) {
      existing.totalSpent += parseFloat(r.amount);
      existing.count++;
      if (r.purchaseDate > existing.lastDate) existing.lastDate = r.purchaseDate;
    } else {
      merchantMap.set(r.merchantName, {
        name: r.merchantName,
        logoUrl: r.merchantLogoUrl ?? null,
        totalSpent: parseFloat(r.amount),
        count: 1,
        lastDate: r.purchaseDate,
      });
    }
  }

  const merchants = Array.from(merchantMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 8)
    .map((m, i) => ({
      id: i + 1,
      name: m.name,
      logoUrl: m.logoUrl,
      totalSpent: Math.round(m.totalSpent * 100) / 100,
      purchaseCount: m.count,
      lastPurchaseDate: m.lastDate,
    }));

  res.json(GetTopMerchantsResponse.parse(merchants));
});

router.get("/dashboard/upcoming-renewals", async (req, res): Promise<void> => {
  const userId = 1;
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const subs = await db.select().from(subscriptionsTable).where(
    and(
      sql`${subscriptionsTable.userId} = ${userId}`,
      gte(subscriptionsTable.renewalDate, today),
      lte(subscriptionsTable.renewalDate, thirtyDaysLater),
      sql`${subscriptionsTable.status} = 'active'`
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

  res.json(GetUpcomingRenewalsResponse.parse(renewals));
});

export default router;
