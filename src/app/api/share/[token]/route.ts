import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Tournament } from "@/lib/types";

// GET /api/share/[token] — public, no auth required
// Accepts either the full UUID token OR the 6-char short code
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const row = token.length === 6
    ? await prisma.savedTournament.findUnique({ where: { shortCode: token.toUpperCase() } })
    : await prisma.savedTournament.findUnique({ where: { shareToken: token } });

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tournament: row.data as unknown as Tournament });
}
