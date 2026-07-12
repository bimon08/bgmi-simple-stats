import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";
import { Tournament, Team } from "@/lib/types";
import { validateSyncKey } from "@/lib/syncKey";

/** Resolve userId from session OR Bearer sync key. Returns { userId, isCollaborator }. */
async function resolveAuth(req: Request): Promise<{ userId: string; isCollaborator: boolean } | null> {
  // 1. Try session first
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id, isCollaborator: false };

  // 2. Try Bearer sync key
  const authHeader = req.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const userId = await validateSyncKey(match[1].trim());
    if (userId) return { userId, isCollaborator: true };
  }

  return null;
}

// GET /api/tournaments — fetch all tournaments for the current user (or collaborator)
export async function GET(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.savedTournament.findMany({
    where: { userId: caller.userId },
    orderBy: { updatedAt: "desc" },
  });

  const tournaments = rows.map(({ data, shareToken, shortCode }) => {
    const t = data as Record<string, unknown>;
    if (shareToken) t.shareToken = shareToken;
    if (shortCode)  t.shortCode  = shortCode;
    return t;
  });

  return NextResponse.json({ tournaments, isCollaborator: caller.isCollaborator });
}

// PUT /api/tournaments — server-side team-level merge upsert
export async function PUT(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tournaments } = await req.json() as { tournaments: Tournament[] };
  if (!Array.isArray(tournaments)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await Promise.all(
    tournaments.map(async (incoming) => {
      const stored = await prisma.savedTournament.findUnique({ where: { id: incoming.id } });
      let mergedData: Tournament = incoming;

      if (stored) {
        const storedT = stored.data as unknown as Tournament;
        // Team-level union: keep teams from both sides
        const incomingTeamMap = new Map<string, Team>((incoming.teams ?? []).map(t => [t.id, t]));
        const storedTeamMap   = new Map<string, Team>((storedT.teams  ?? []).map(t => [t.id, t]));
        const allTeamIds = new Set([...incomingTeamMap.keys(), ...storedTeamMap.keys()]);
        const mergedTeams: Team[] = [];
        allTeamIds.forEach(id => {
          mergedTeams.push(incomingTeamMap.get(id) ?? storedTeamMap.get(id)!);
        });
        mergedData = { ...incoming, teams: mergedTeams };
      }

      return prisma.savedTournament.upsert({
        where: { id: incoming.id },
        update: {
          data: mergedData as object,
          userId: caller.userId,
          entryFee: incoming.entryFee ?? 0,
          isActive: incoming.isActive ?? false,
        },
        create: {
          id: incoming.id,
          userId: caller.userId,
          data: mergedData as object,
          entryFee: incoming.entryFee ?? 0,
          isActive: incoming.isActive ?? false,
        },
      });
    })
  );

  // Auto-book leaders for active tournaments
  const activeTournaments = tournaments.filter(t => (t.isActive ?? false) && (t.entryFee ?? 0) > 0);
  if (activeTournaments.length > 0) {
    const wallets = await prisma.wallet.findMany({
      where: { userId: caller.userId, phone: { not: null } },
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
        const normalize = (p: string) => { const d = p.replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };
        const wallet = wallets.find(w => normalize(w.phone ?? "") === normalize(phoneDigits));
        if (!wallet || bookedIds.has(wallet.id)) continue;
        const roster = { teamName: (team as { name?: string }).name ?? "", players: (team as { players?: string[] }).players ?? [] };
        await prisma.slotBooking.create({
          data: { walletId: wallet.id, tournamentId: t.id, entryFee: t.entryFee ?? 0, status: "PENDING", bookedByAdmin: true, roster },
        }).catch(() => {});
        bookedIds.add(wallet.id);
      }
    }
  }

  return NextResponse.json({ ok: true, count: tournaments.length });
}
