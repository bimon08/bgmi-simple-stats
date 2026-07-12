import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Tournament, Team } from "@/lib/types";

// GET /api/share/[token] — public read, no auth required
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const row = token.length === 6
    ? await prisma.savedTournament.findUnique({ where: { shortCode: token.toUpperCase() } })
    : await prisma.savedTournament.findUnique({ where: { shareToken: token } });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tournament: row.data as unknown as Tournament, updatedAt: row.updatedAt });
}

// PUT /api/share/[token] — collaborative write, no auth (token = access key)
// Performs team-level union merge so concurrent edits don't overwrite each other.
// Collaborators can edit teams/players but cannot delete the tournament.
export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const row = token.length === 6
    ? await prisma.savedTournament.findUnique({ where: { shortCode: token.toUpperCase() } })
    : await prisma.savedTournament.findUnique({ where: { shareToken: token } });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { tournament: incoming } = await req.json() as { tournament: Tournament };
  if (!incoming) return NextResponse.json({ error: "No data" }, { status: 400 });

  // Team-level union merge: preserve teams added by any collaborator
  const stored = row.data as unknown as Tournament;
  const incomingTeamMap = new Map<string, Team>((incoming.teams ?? []).map(t => [t.id, t]));
  const storedTeamMap   = new Map<string, Team>((stored.teams   ?? []).map(t => [t.id, t]));
  const allTeamIds = new Set([...incomingTeamMap.keys(), ...storedTeamMap.keys()]);
  const mergedTeams: Team[] = [];
  allTeamIds.forEach(id => {
    mergedTeams.push(incomingTeamMap.get(id) ?? storedTeamMap.get(id)!);
  });

  const mergedData: Tournament = { ...incoming, teams: mergedTeams };

  const updated = await prisma.savedTournament.update({
    where: { id: row.id },
    data: {
      data: mergedData as object,
      entryFee: incoming.entryFee ?? 0,
      isActive: incoming.isActive ?? false,
    },
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}
