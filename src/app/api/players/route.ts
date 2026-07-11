import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const wallets = await prisma.wallet.findMany({
      select: { playerName: true, phone: true },
      orderBy: { playerName: "asc" },
    });
    return NextResponse.json(wallets);
  } catch (err) {
    console.error("Failed to fetch players:", err);
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
  }
}
