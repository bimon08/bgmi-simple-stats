import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// PUT /api/pay/[token]/roster
// Player updates their roster (teamName + players) for a specific tournament.
export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { tournamentId, teamName, players } = await req.json();

  if (!tournamentId) return NextResponse.json({ error: "tournamentId required" }, { status: 400 });

  const wallet = await prisma.wallet.findUnique({ where: { shareToken: token } });
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const booking = await prisma.slotBooking.findUnique({
    where: { walletId_tournamentId: { walletId: wallet.id, tournamentId } },
  });
  if (!booking) return NextResponse.json({ error: "No booking found" }, { status: 404 });

  const roster = { teamName: teamName ?? "", players: players ?? [] };
  await prisma.slotBooking.update({
    where: { walletId_tournamentId: { walletId: wallet.id, tournamentId } },
    data: { roster },
  });

  return NextResponse.json({ ok: true, roster });
}
