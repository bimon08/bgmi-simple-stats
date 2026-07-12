import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Normalize phone to last 10 digits (handles +91, 0-prefix, any country code)
const normalizePhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
};

// GET /api/pay/[token]/tournaments
// Returns all ACTIVE tournaments belonging to the wallet owner.
// Also auto-creates bookings for any active tournament where this wallet's
// phone matches a team leader (catches cases the PUT /api/tournaments missed).
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const wallet = await prisma.wallet.findUnique({
    where: { shareToken: token },
    include: {
      bookings: { select: { tournamentId: true, status: true, bookedByAdmin: true, roster: true } },
      user: {
        include: {
          savedTournaments: {
            where: { isActive: true },
            select: { id: true, data: true, entryFee: true },
          },
        },
      },
    },
  });

  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bookedIds = new Set(wallet.bookings.map((b) => b.tournamentId));
  const walletNorm = wallet.phone ? normalizePhone(wallet.phone) : null;

  // Auto-create bookings for any matching team leader not yet booked
  if (walletNorm) {
    for (const t of wallet.user.savedTournaments) {
      if (bookedIds.has(t.id)) continue;
      const data = t.data as { teams?: { phone?: string; name?: string; players?: string[] }[] };
      const matchingTeam = (data.teams ?? []).find(
        (team) => team.phone && normalizePhone(team.phone) === walletNorm
      );
      if (!matchingTeam) continue;
      const roster = { teamName: matchingTeam.name ?? "", players: matchingTeam.players ?? [] };
      await prisma.slotBooking.create({
        data: {
          walletId: wallet.id,
          tournamentId: t.id,
          entryFee: t.entryFee ?? 0,
          status: "PENDING",
          bookedByAdmin: true,
          roster,
        },
      }).catch(() => {}); // ignore duplicates
      bookedIds.add(t.id);
    }
  }

  // Re-fetch bookings after potential auto-create
  const freshBookings = await prisma.slotBooking.findMany({
    where: { walletId: wallet.id },
    select: { tournamentId: true, status: true, bookedByAdmin: true, roster: true },
  });
  const bookedMap = new Map(freshBookings.map((b) => [b.tournamentId, b]));

  const tournaments = wallet.user.savedTournaments.map((t) => {
    const data = t.data as { name?: string };
    const booking = bookedMap.get(t.id) ?? null;
    return {
      id: t.id,
      name: data.name ?? "Tournament",
      entryFee: t.entryFee,
      bookingStatus: booking?.status ?? null,
      bookedByAdmin: booking?.bookedByAdmin ?? false,
      roster: booking?.roster ?? null,
    };
  });

  return NextResponse.json({ tournaments });
}
