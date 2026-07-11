import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

// GET /api/wallets — list all wallets (uses stored balance column)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wallets = await prisma.wallet.findMany({
    where: { userId: session.user.id },
    include: { transactions: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(wallets);
}

// POST /api/wallets — create new player wallet
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { playerName, phone } = await req.json();
  if (!playerName) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const wallet = await prisma.wallet.create({
    data: { userId: session.user.id, playerName, phone: phone || null },
  });
  return NextResponse.json(wallet);
}
