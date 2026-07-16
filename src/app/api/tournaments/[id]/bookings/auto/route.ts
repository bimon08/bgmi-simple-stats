import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

// POST /api/tournaments/[id]/bookings/auto
// Loops through all teams, finds wallets by leader phone, creates PENDING bookings.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const tournament = await prisma.savedTournament.findFirst({
    where: { id, userId: caller.userId },
  });
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = tournament.data as { teams?: { phone?: string; name?: string }[] };
  const teams = data.teams ?? [];

  const phonesWithTeam = teams
    .map(t => ({ phone: (t.phone ?? "").replace(/\D/g, ""), name: t.name ?? "" }))
    .filter(t => t.phone.length >= 7);

  if (phonesWithTeam.length === 0) {
    return NextResponse.json({ ok: true, booked: 0, message: "No teams with phone numbers" });
  }

  const wallets = await prisma.wallet.findMany({
    where: { userId: caller.userId, phone: { not: null } },
    select: { id: true, phone: true },
  });

  const existing = await prisma.slotBooking.findMany({
    where: { tournamentId: id },
    select: { walletId: true },
  });
  const bookedWalletIds = new Set(existing.map(b => b.walletId));

  let booked = 0;
  for (const team of phonesWithTeam) {
    const wallet = wallets.find(w => (w.phone ?? "").replace(/\D/g, "") === team.phone);
    if (!wallet || bookedWalletIds.has(wallet.id)) continue;
    await prisma.slotBooking.create({
      data: {
        walletId: wallet.id,
        tournamentId: id,
        entryFee: tournament.entryFee,
        status: "PENDING",
      },
    });
    bookedWalletIds.add(wallet.id);
    booked++;
  }

  return NextResponse.json({ ok: true, booked });
}
