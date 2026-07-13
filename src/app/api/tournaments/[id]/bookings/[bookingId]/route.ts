import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

/**
 * DELETE /api/tournaments/[id]/bookings/[bookingId]
 * Admin skips/removes a single booking.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tournamentId, bookingId } = await params;

  // Verify tournament belongs to this user
  const tournament = await prisma.savedTournament.findFirst({
    where: { id: tournamentId, userId: session.user.id },
  });
  if (!tournament)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.slotBooking.delete({ where: { id: bookingId } });

  return NextResponse.json({ ok: true });
}
