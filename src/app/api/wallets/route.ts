import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

// GET /api/wallets — list all wallets (uses stored balance column)
export async function GET(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallets = await prisma.wallet.findMany({
    where: { userId: caller.userId },
    include: { transactions: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(wallets);
}

// POST /api/wallets — create new player wallet
export async function POST(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { playerName, phone } = await req.json();
  if (!playerName) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const wallet = await prisma.wallet.create({
    data: { userId: caller.userId, playerName, phone: phone || null },
  });
  return NextResponse.json(wallet);
}
