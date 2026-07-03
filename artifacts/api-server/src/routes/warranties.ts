import { Router, type IRouter } from "express";
import { db, warrantiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateWarrantyBody,
  GetWarrantyParams,
  UpdateWarrantyParams,
  UpdateWarrantyBody,
  DeleteWarrantyParams,
  ListWarrantiesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getStatus(warrantyEndDate: string): "active" | "expiring_soon" | "expired" {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  if (warrantyEndDate < today) return "expired";
  if (warrantyEndDate <= thirtyDaysLater) return "expiring_soon";
  return "active";
}

function getDaysRemaining(warrantyEndDate: string): number {
  const now = new Date();
  const end = new Date(warrantyEndDate);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function mapWarranty(w: typeof warrantiesTable.$inferSelect) {
  return {
    id: w.id,
    productName: w.productName,
    merchantName: w.merchantName ?? null,
    purchaseDate: w.purchaseDate,
    warrantyEndDate: w.warrantyEndDate,
    daysRemaining: getDaysRemaining(w.warrantyEndDate),
    status: getStatus(w.warrantyEndDate),
    reminderEnabled: w.reminderEnabled,
    notes: w.notes ?? null,
    createdAt: w.createdAt.toISOString(),
  };
}

router.get("/warranties", async (req, res): Promise<void> => {
  const params = ListWarrantiesQueryParams.safeParse(req.query);
  const userId = 1;

  let warranties = await db.select().from(warrantiesTable).where(sql`${warrantiesTable.userId} = ${userId}`);

  if (params.success) {
    const { status, search } = params.data;
    if (search) warranties = warranties.filter((w) =>
      w.productName.toLowerCase().includes(search.toLowerCase()) ||
      (w.merchantName ?? "").toLowerCase().includes(search.toLowerCase())
    );
    if (status) warranties = warranties.filter((w) => getStatus(w.warrantyEndDate) === status);
  }

  res.json(warranties.map(mapWarranty));
});

router.post("/warranties", async (req, res): Promise<void> => {
  const parsed = CreateWarrantyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [w] = await db.insert(warrantiesTable).values({
    userId: 1,
    productName: parsed.data.productName,
    merchantName: parsed.data.merchantName ?? null,
    purchaseDate: parsed.data.purchaseDate,
    warrantyEndDate: parsed.data.warrantyEndDate,
    reminderEnabled: parsed.data.reminderEnabled ?? true,
    notes: parsed.data.notes ?? null,
  }).returning();
  res.status(201).json(mapWarranty(w));
});

router.get("/warranties/:id", async (req, res): Promise<void> => {
  const params = GetWarrantyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [w] = await db.select().from(warrantiesTable).where(and(eq(warrantiesTable.id, params.data.id), sql`${warrantiesTable.userId} = 1`));
  if (!w) { res.status(404).json({ error: "Warranty not found" }); return; }
  res.json(mapWarranty(w));
});

router.patch("/warranties/:id", async (req, res): Promise<void> => {
  const params = UpdateWarrantyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateWarrantyBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: Partial<typeof warrantiesTable.$inferInsert> = {};
  if (body.data.productName != null) updates.productName = body.data.productName;
  if (body.data.merchantName != null) updates.merchantName = body.data.merchantName;
  if (body.data.warrantyEndDate != null) updates.warrantyEndDate = body.data.warrantyEndDate;
  if (body.data.reminderEnabled != null) updates.reminderEnabled = body.data.reminderEnabled;
  if (body.data.notes != null) updates.notes = body.data.notes;

  const [w] = await db.update(warrantiesTable).set(updates).where(and(eq(warrantiesTable.id, params.data.id), sql`${warrantiesTable.userId} = 1`)).returning();
  if (!w) { res.status(404).json({ error: "Warranty not found" }); return; }
  res.json(mapWarranty(w));
});

router.delete("/warranties/:id", async (req, res): Promise<void> => {
  const params = DeleteWarrantyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [w] = await db.delete(warrantiesTable).where(and(eq(warrantiesTable.id, params.data.id), sql`${warrantiesTable.userId} = 1`)).returning();
  if (!w) { res.status(404).json({ error: "Warranty not found" }); return; }
  res.sendStatus(204);
});

export default router;
