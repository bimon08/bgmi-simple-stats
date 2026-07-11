import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/wallets/[id] — single wallet with transactions (uses stored balance)
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wallet = await prisma.wallet.findUnique({
    where: { id },
    include: { transactions: { orderBy: { createdAt: "desc" } } },
  });
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(wallet);
}
