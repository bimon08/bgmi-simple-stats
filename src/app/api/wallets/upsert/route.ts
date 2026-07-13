import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

/**
 * POST /api/wallets/upsert
 * Creates a wallet for a player if one with the same phone doesn't already exist.
 * Used when a team is added with a leader name + phone to auto-provision a wallet.
 *
 * Body: { playerName: string; phone: string }
 * Returns: { wallet, created: boolean }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { playerName, phone } = await req.json();
  if (!playerName || !phone)
    return NextResponse.json({ error: "playerName and phone required" }, { status: 400 });

  // Normalize phone — last 10 digits for dedup
  const norm = (p: string) => {
    const d = p.replace(/\D/g, "");
    return d.length > 10 ? d.slice(-10) : d;
  };
  const normalizedPhone = norm(phone);

  // Check if wallet already exists for this user + phone
  const existing = await prisma.wallet.findFirst({
    where: { userId: session.user.id, phone: { endsWith: normalizedPhone } },
  });

  if (existing) {
    // Update name if it changed (admin may rename the team leader)
    if (existing.playerName !== playerName) {
      const updated = await prisma.wallet.update({
        where: { id: existing.id },
        data: { playerName },
      });
      return NextResponse.json({ wallet: updated, created: false });
    }
    return NextResponse.json({ wallet: existing, created: false });
  }

  // Create new wallet with balance 0
  const wallet = await prisma.wallet.create({
    data: {
      userId: session.user.id,
      playerName,
      phone: normalizedPhone,
      balance: 0,
    },
  });

  return NextResponse.json({ wallet, created: true });
}
