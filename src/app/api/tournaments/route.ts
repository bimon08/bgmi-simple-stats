import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";
import { Tournament } from "@/lib/types";

// GET /api/tournaments — fetch all tournaments for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.savedTournament.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  const tournaments = rows.map(({ data, shareToken, shortCode }) => {
    const t = data as Record<string, unknown>;
    if (shareToken) t.shareToken = shareToken;
    if (shortCode)  t.shortCode  = shortCode;
    return t;
  });
  return NextResponse.json({ tournaments });
}

// PUT /api/tournaments — upsert a batch of tournaments
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tournaments } = await req.json() as { tournaments: Tournament[] };
  if (!Array.isArray(tournaments)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await Promise.all(
    tournaments.map((t) =>
      prisma.savedTournament.upsert({
        where: { id: t.id },
        update: {
          data: t as object,
          userId: session.user!.id!,
          entryFee: t.entryFee ?? 0,
          isActive: t.isActive ?? false,
        },
        create: {
          id: t.id,
          userId: session.user!.id!,
          data: t as object,
          entryFee: t.entryFee ?? 0,
          isActive: t.isActive ?? false,
        },
      })
    )
  );

  // Auto-book leaders by phone number for active tournaments with an entry fee.
  // No balance check — balance can go negative (admin is debiting on their behalf).
  const activeTournaments = tournaments.filter(t => (t.isActive ?? false) && (t.entryFee ?? 0) > 0);
  if (activeTournaments.length > 0) {
    const wallets = await prisma.wallet.findMany({
      where: { userId: session.user.id!, phone: { not: null } },
      select: { id: true, phone: true },
    });

    for (const t of activeTournaments) {
      const existing = await prisma.slotBooking.findMany({
        where: { tournamentId: t.id },
        select: { walletId: true },
      });
      const bookedIds = new Set(existing.map(b => b.walletId));

      for (const team of (t.teams ?? [])) {
        if (!team.phone) continue;
        const phoneDigits = (team.phone as string).replace(/\D/g, "");
        if (phoneDigits.length < 7) continue;
        // Normalize: strip all non-digits, take last 10 digits.
        // Handles +91, 0 prefix, any country code, spaces, dashes.
        const normalize = (p: string) => {
          const d = p.replace(/\D/g, "");
          return d.length > 10 ? d.slice(-10) : d;
        };
        const normTeam = normalize(phoneDigits);
        const wallet = wallets.find(w => normalize(w.phone ?? "") === normTeam);
        if (!wallet || bookedIds.has(wallet.id)) continue;
        // Seed roster from the team entry so player sees their pre-filled team
        const roster = {
          teamName: (team as { name?: string }).name ?? "",
          players: (team as { players?: string[] }).players ?? [],
        };
        await prisma.slotBooking.create({
          data: { walletId: wallet.id, tournamentId: t.id, entryFee: t.entryFee ?? 0, status: "PENDING", bookedByAdmin: true, roster },
        }).catch(() => {}); // ignore unique constraint errors (race safety)
        bookedIds.add(wallet.id);
      }
    }
  }

  return NextResponse.json({ ok: true, count: tournaments.length });
}
