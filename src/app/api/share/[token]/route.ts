import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Tournament } from "@/lib/types";

// GET /api/share/[token] — public read, no auth required
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const row = token.length === 6
    ? await prisma.savedTournament.findUnique({ where: { shortCode: token.toUpperCase() } })
    : await prisma.savedTournament.findUnique({ where: { shareToken: token } });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tournament: row.data as unknown as Tournament, updatedAt: row.updatedAt });
}

// PUT /api/share/[token] — collaborative write, no auth required (token = access key)
export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const row = token.length === 6
    ? await prisma.savedTournament.findUnique({ where: { shortCode: token.toUpperCase() } })
    : await prisma.savedTournament.findUnique({ where: { shareToken: token } });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { tournament } = await req.json() as { tournament: Tournament };
  if (!tournament) return NextResponse.json({ error: "No data" }, { status: 400 });

  const updated = await prisma.savedTournament.update({
    where: { id: row.id },
    data: {
      data: tournament as object,
      entryFee: tournament.entryFee ?? 0,
      isActive: tournament.isActive ?? false,
    },
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}
