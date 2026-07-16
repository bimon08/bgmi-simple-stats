import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

// GET /api/wallets/[id] — single wallet with transactions (uses stored balance)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const wallet = await prisma.wallet.findUnique({
    where: { id },
    include: { transactions: { orderBy: { createdAt: "desc" } } },
  });
  if (!wallet || wallet.userId !== caller.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(wallet);
}
