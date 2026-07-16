import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

// GET /api/tournaments/[id]/bookings — admin: list all bookings for a tournament
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const tournament = await prisma.savedTournament.findFirst({
    where: { id, userId: caller.userId },
  });
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bookings = await prisma.slotBooking.findMany({
    where: { tournamentId: id },
    include: {
      wallet: { select: { id: true, playerName: true, phone: true, balance: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pending = bookings.filter((b) => b.status === "PENDING").length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;

  return NextResponse.json({ bookings, pending, confirmed, entryFee: tournament.entryFee, isActive: tournament.isActive });
}
