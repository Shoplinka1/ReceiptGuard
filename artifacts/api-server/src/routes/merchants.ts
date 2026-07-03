import { Router, type IRouter } from "express";
import { db, receiptsTable, activityLogsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { ListActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/merchants", async (req, res): Promise<void> => {
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
    .map((m, i) => ({
      id: i + 1,
      name: m.name,
      logoUrl: m.logoUrl,
      purchaseCount: m.count,
      totalSpent: Math.round(m.totalSpent * 100) / 100,
      lastPurchaseDate: m.lastDate || null,
    }));

  res.json(merchants);
});

router.get("/activity", async (req, res): Promise<void> => {
  const params = ListActivityQueryParams.safeParse(req.query);
  const userId = 1;
  const limit = params.success && params.data.limit ? params.data.limit : 20;

  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(sql`${activityLogsTable.userId} = ${userId}`)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit);

  const mapped = logs.map((l) => ({
    id: l.id,
    type: l.type,
    description: l.description,
    metadata: l.metadata ? JSON.parse(l.metadata) : null,
    createdAt: l.createdAt.toISOString(),
  }));

  res.json(mapped);
});

export default router;
