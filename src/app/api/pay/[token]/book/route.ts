import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/pay/[token]/book
// Body: { tournamentId: string }
// Creates a PENDING SlotBooking. Does NOT debit the wallet.
// Also flips the matching team to IN (out:false) if they were marked OUT.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { tournamentId, players, teamName } = await req.json() as { tournamentId: string; players?: string[]; teamName?: string };

  if (!tournamentId) return NextResponse.json({ error: "tournamentId required" }, { status: 400 });

  const wallet = await prisma.wallet.findUnique({ where: { shareToken: token } });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const tournament = await prisma.savedTournament.findFirst({
    where: { id: tournamentId, isActive: true, userId: wallet.userId },
  });
  if (!tournament) return NextResponse.json({ error: "Tournament not found or not active" }, { status: 404 });

  // No balance check — wallet can go negative; admin debit handles the actual deduction

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
      roster: {
        teamName: teamName?.trim() || (wallet.playerName ?? ""),
        players: (players ?? []).map((p: string) => p.trim()).filter(Boolean),
      },
    },
  });

  // Sync team entry: flip OUT→IN if phone matches, or CREATE new team entry if not
  try {
    const norm = (p?: string | null) => { const d = (p ?? "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };
    const walletPhone = norm(wallet.phone);
    if (walletPhone.length >= 7) {
      const data = tournament.data as { teams?: Array<{ id: string; name?: string; phone?: string; out?: boolean; players?: string[] }> };
      const teams = Array.isArray(data?.teams) ? [...data.teams] : [];
      const existingIdx = teams.findIndex(t => norm(t.phone) === walletPhone);
      
      if (existingIdx >= 0) {
        // Existing team — flip IN and update players from roster
        const filled = (players ?? []).map((p: string) => p.trim()).filter(Boolean);
        teams[existingIdx] = {
          ...teams[existingIdx],
          out: false,
          ...(filled.length > 0 && { players: filled }),
        };
      } else {
        // No matching team — create one from the booking roster
        const filled = (players ?? []).map((p: string) => p.trim()).filter(Boolean);
        teams.push({
          id: crypto.randomUUID(),
          name: teamName?.trim() || (wallet.playerName ?? "Unknown"),
          phone: wallet.phone ?? "",
          players: filled.length > 0 ? filled : undefined,
          out: false,
        });
      }

      await prisma.savedTournament.update({
        where: { id: tournamentId },
        data: { data: { ...data, teams, updatedAt: new Date().toISOString() } as object },
      });
    }
  } catch { /* non-fatal — booking already created */ }

  return NextResponse.json({ ok: true, bookingId: booking.id, status: "PENDING" });
}

// DELETE /api/pay/[token]/book
// Body: { bookingId: string }
// Cancels a PENDING self-booking (not admin-booked, not confirmed).
export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { bookingId } = await req.json() as { bookingId: string };
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const wallet = await prisma.wallet.findUnique({ where: { shareToken: token } });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const booking = await prisma.slotBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.walletId !== wallet.id)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status === "CONFIRMED")
    return NextResponse.json({ error: "Cannot cancel a confirmed booking" }, { status: 400 });
  if (booking.bookedByAdmin)
    return NextResponse.json({ error: "Admin-booked slots cannot be cancelled by player" }, { status: 403 });

  await prisma.slotBooking.delete({ where: { id: bookingId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/pay/[token]/book
// Body: { bookingId, players }
// Updates the roster of a PENDING self-booking.
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { bookingId, players, teamName } = await req.json() as { bookingId: string; players: string[]; teamName?: string };
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const filled = (players ?? []).map((p: string) => p.trim()).filter(Boolean);
  if (filled.length < 2) return NextResponse.json({ error: "At least 2 players required" }, { status: 400 });

  const wallet = await prisma.wallet.findUnique({ where: { shareToken: token } });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const booking = await prisma.slotBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.walletId !== wallet.id)
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status === "CONFIRMED")
    return NextResponse.json({ error: "Cannot edit a confirmed booking" }, { status: 400 });

  const updatedRoster = { teamName: teamName?.trim() || (booking.roster as { teamName?: string })?.teamName || "", players: filled };

  await prisma.slotBooking.update({
    where: { id: bookingId },
    data: { roster: updatedRoster },
  });

  // Also update or create the matching team entry in the tournament data blob
  try {
    const norm = (p?: string | null) => { const d = (p ?? "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };
    const walletPhone = norm(wallet.phone);
    if (walletPhone.length >= 7) {
      const tournament = await prisma.savedTournament.findUnique({ where: { id: booking.tournamentId } });
      if (tournament) {
        const data = tournament.data as { teams?: Array<{ id: string; name?: string; phone?: string; out?: boolean; players?: string[] }> };
        const teams = Array.isArray(data?.teams) ? [...data.teams] : [];
        const idx = teams.findIndex(t => norm(t.phone) === walletPhone);
        if (idx >= 0) {
          teams[idx] = { ...teams[idx], out: false, ...(teamName?.trim() && { name: teamName.trim() }), players: filled };
        } else {
          // No matching team — create one
          teams.push({
            id: crypto.randomUUID(),
            name: teamName?.trim() || (wallet.playerName ?? "Unknown"),
            phone: wallet.phone ?? "",
            players: filled,
            out: false,
          });
        }
        await prisma.savedTournament.update({
          where: { id: booking.tournamentId },
          data: { data: { ...data, teams, updatedAt: new Date().toISOString() } as object },
        });
      }
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
