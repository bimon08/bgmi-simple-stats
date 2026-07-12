import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/pay/[token]/book
// Body: { tournamentId: string }
// Creates a PENDING SlotBooking. Does NOT debit the wallet.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { tournamentId } = await req.json() as { tournamentId: string };

  if (!tournamentId) return NextResponse.json({ error: "tournamentId required" }, { status: 400 });

  const wallet = await prisma.wallet.findUnique({ where: { shareToken: token } });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const tournament = await prisma.savedTournament.findFirst({
    where: { id: tournamentId, isActive: true, userId: wallet.userId },
  });
  if (!tournament) return NextResponse.json({ error: "Tournament not found or not active" }, { status: 404 });

  if (wallet.balance < tournament.entryFee) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  // Upsert — idempotent if already booked
  const existing = await prisma.slotBooking.findUnique({
    where: { walletId_tournamentId: { walletId: wallet.id, tournamentId } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, status: existing.status, already: true });
  }

  const booking = await prisma.slotBooking.create({
    data: {
      walletId: wallet.id,
      tournamentId,
      entryFee: tournament.entryFee,
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, bookingId: booking.id, status: "PENDING" });
}
