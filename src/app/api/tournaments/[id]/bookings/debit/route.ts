import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

// POST /api/tournaments/[id]/bookings/debit — admin: debit all PENDING bookings
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const tournament = await prisma.savedTournament.findFirst({
    where: { id, userId: caller.userId },
  });
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pending = await prisma.slotBooking.findMany({
    where: { tournamentId: id, status: "PENDING" },
    include: { wallet: true },
  });

  if (pending.length === 0) return NextResponse.json({ ok: true, debited: 0 });

  const tournamentName = (tournament.data as { name?: string }).name ?? "Tournament";

  await prisma.$transaction(
    pending.flatMap((booking) => [
      // Debit wallet balance
      prisma.wallet.update({
        where: { id: booking.walletId },
        data: { balance: { decrement: booking.entryFee } },
      }),
      // Create transaction record
      prisma.transaction.create({
        data: {
          walletId: booking.walletId,
          amount: -booking.entryFee,
          note: `Entry fee — ${tournamentName}`,
        },
      }),
      // Mark booking confirmed
      prisma.slotBooking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      }),
    ])
  );

  return NextResponse.json({ ok: true, debited: pending.length });
}
