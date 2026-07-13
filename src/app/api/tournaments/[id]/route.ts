import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

/**
 * DELETE /api/tournaments/[id]
 * Permanently removes a tournament from the DB for the current user.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Only delete if it belongs to this user
  const existing = await prisma.savedTournament.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.savedTournament.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/tournaments/[id]
 * Directly updates isActive and/or entryFee on the DB row — no sync required.
 * Used by BookingsModal toggle for an immediate, auth-safe update.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { isActive?: boolean; entryFee?: number };

  const existing = await prisma.savedTournament.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build updated data object: patch the JSON blob too so doSync sees consistent value
  const existingData = (existing.data ?? {}) as Record<string, unknown>;
  const updatedData: Record<string, unknown> = { ...existingData };
  if (body.isActive !== undefined) updatedData.isActive = body.isActive;
  if (body.entryFee  !== undefined) updatedData.entryFee  = body.entryFee;

  const updated = await prisma.savedTournament.update({
    where: { id },
    data: {
      data: updatedData as object,
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.entryFee !== undefined && { entryFee: body.entryFee }),
    },
  });

  const response = NextResponse.json({ ok: true, isActive: updated.isActive, entryFee: updated.entryFee });

  // When turning ON: auto-book all wallet-matched teams
  if (body.isActive === true) {
    autoBook(id, session.user.id, updatedData).catch(() => {});
  }

  return response;
}

async function autoBook(tournamentId: string, userId: string, tournament: Record<string, unknown>) {
  const teams = (tournament.teams ?? []) as Array<{ phone?: string; name?: string; players?: string[] }>;
  if (!teams.length) return;

  const wallets = await prisma.wallet.findMany({
    where: { userId, phone: { not: null } },
    select: { id: true, phone: true },
  });
  const existingBookings = await prisma.slotBooking.findMany({
    where: { tournamentId },
    select: { walletId: true },
  });
  const bookedIds = new Set(existingBookings.map(b => b.walletId));
  const normalize = (p: string) => { const d = p.replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };

  for (const team of teams) {
    if (!team.phone) continue;
    const phoneDigits = (team.phone as string).replace(/\D/g, "");
    if (phoneDigits.length < 7) continue;
    const wallet = wallets.find(w => normalize(w.phone ?? "") === normalize(phoneDigits));
    if (!wallet || bookedIds.has(wallet.id)) continue;
    const roster = { teamName: team.name ?? "", players: team.players ?? [] };
    await prisma.slotBooking.create({
      data: { walletId: wallet.id, tournamentId, entryFee: (tournament.entryFee as number) ?? 0, status: "PENDING", bookedByAdmin: true, roster },
    }).catch(() => {});
    bookedIds.add(wallet.id);
  }
}
