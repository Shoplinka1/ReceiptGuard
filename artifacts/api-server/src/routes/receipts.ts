import { Router, type IRouter } from "express";
import { db, receiptsTable } from "@workspace/db";
import { eq, sql, ilike, and, gte, lte, desc } from "drizzle-orm";
import {
  CreateReceiptBody,
  GetReceiptParams,
  UpdateReceiptParams,
  UpdateReceiptBody,
  DeleteReceiptParams,
  ListReceiptsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function mapReceipt(r: typeof receiptsTable.$inferSelect) {
  return {
    id: r.id,
    merchantName: r.merchantName,
    merchantLogoUrl: r.merchantLogoUrl ?? null,
    amount: parseFloat(r.amount),
    currency: r.currency,
    purchaseDate: r.purchaseDate,
    category: r.category,
    status: r.status as "detected" | "verified" | "manual",
    invoiceNumber: r.invoiceNumber ?? null,
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/receipts", async (req, res): Promise<void> => {
  const params = ListReceiptsQueryParams.safeParse(req.query);
  const userId = 1;

  const conditions = [sql`${receiptsTable.userId} = ${userId}`];

  if (params.success) {
    const { merchant, category, dateFrom, dateTo } = params.data;
    if (merchant) conditions.push(ilike(receiptsTable.merchantName, `%${merchant}%`));
    if (category) conditions.push(sql`${receiptsTable.category} = ${category}`);
    if (dateFrom) conditions.push(gte(receiptsTable.purchaseDate, dateFrom));
    if (dateTo) conditions.push(lte(receiptsTable.purchaseDate, dateTo));
  }

  const allReceipts = await db
    .select()
    .from(receiptsTable)
    .where(and(...conditions))
    .orderBy(desc(receiptsTable.purchaseDate));

  let filtered = allReceipts;
  if (params.success && params.data.search) {
    const s = params.data.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.merchantName.toLowerCase().includes(s) ||
        r.category.toLowerCase().includes(s) ||
        (r.invoiceNumber ?? "").toLowerCase().includes(s)
    );
  }
  if (params.success && params.data.minAmount != null) {
    filtered = filtered.filter((r) => parseFloat(r.amount) >= params.data.minAmount!);
  }
  if (params.success && params.data.maxAmount != null) {
    filtered = filtered.filter((r) => parseFloat(r.amount) <= params.data.maxAmount!);
  }

  const page = params.success && params.data.page ? params.data.page : 1;
  const pageSize = params.success && params.data.pageSize ? params.data.pageSize : 20;
  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize).map(mapReceipt);

  res.json({ items, total, page, pageSize });
});

router.post("/receipts", async (req, res): Promise<void> => {
  const parsed = CreateReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [r] = await db.insert(receiptsTable).values({
    userId: 1,
    merchantName: parsed.data.merchantName,
    merchantLogoUrl: parsed.data.merchantLogoUrl ?? null,
    amount: String(parsed.data.amount),
    currency: parsed.data.currency ?? "USD",
    purchaseDate: parsed.data.purchaseDate,
    category: parsed.data.category,
    status: "manual",
    invoiceNumber: parsed.data.invoiceNumber ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(mapReceipt(r));
});

router.get("/receipts/:id", async (req, res): Promise<void> => {
  const params = GetReceiptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [r] = await db.select().from(receiptsTable).where(and(eq(receiptsTable.id, params.data.id), sql`${receiptsTable.userId} = 1`));
  if (!r) { res.status(404).json({ error: "Receipt not found" }); return; }
  res.json(mapReceipt(r));
});

router.patch("/receipts/:id", async (req, res): Promise<void> => {
  const params = UpdateReceiptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateReceiptBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: Partial<typeof receiptsTable.$inferInsert> = {};
  if (body.data.merchantName != null) updates.merchantName = body.data.merchantName;
  if (body.data.amount != null) updates.amount = String(body.data.amount);
  if (body.data.purchaseDate != null) updates.purchaseDate = body.data.purchaseDate;
  if (body.data.category != null) updates.category = body.data.category;
  if (body.data.invoiceNumber != null) updates.invoiceNumber = body.data.invoiceNumber;
  if (body.data.notes != null) updates.notes = body.data.notes;

  const [r] = await db.update(receiptsTable).set(updates).where(and(eq(receiptsTable.id, params.data.id), sql`${receiptsTable.userId} = 1`)).returning();
  if (!r) { res.status(404).json({ error: "Receipt not found" }); return; }
  res.json(mapReceipt(r));
});

router.delete("/receipts/:id", async (req, res): Promise<void> => {
  const params = DeleteReceiptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [r] = await db.delete(receiptsTable).where(and(eq(receiptsTable.id, params.data.id), sql`${receiptsTable.userId} = 1`)).returning();
  if (!r) { res.status(404).json({ error: "Receipt not found" }); return; }
  res.sendStatus(204);
});

export default router;
