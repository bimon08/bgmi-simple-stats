import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

const MAX_TRANSACTIONS = 10;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const wallet = await prisma.wallet.findFirst({ where: { id, userId: caller.userId } });
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { amount, note } = await req.json();
  if (!amount) return NextResponse.json({ error: "Amount required" }, { status: 400 });

  const amt = parseInt(amount);

  // Create transaction + update balance atomically
  const [txn] = await prisma.$transaction([
    prisma.transaction.create({ data: { walletId: id, amount: amt, note: note || "" } }),
    prisma.wallet.update({ where: { id }, data: { balance: { increment: amt } } }),
  ]);

  // Prune to keep only last 10 transactions
  const all = await prisma.transaction.findMany({
    where: { walletId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (all.length > MAX_TRANSACTIONS) {
    const toDelete = all.slice(MAX_TRANSACTIONS).map(t => t.id);
    await prisma.transaction.deleteMany({ where: { id: { in: toDelete } } });
  }

  return NextResponse.json(txn);
}
