import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/pay/[token] — public player wallet by share token
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wallet = await prisma.wallet.findUnique({
    where: { shareToken: token },
    include: { transactions: { orderBy: { createdAt: "desc" } } },
  });
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(wallet);
}
