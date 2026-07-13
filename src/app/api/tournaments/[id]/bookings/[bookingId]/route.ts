import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

/**
 * PATCH /api/tournaments/[id]/bookings/[bookingId]
 * Admin toggles skip status for a single booking.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; bookingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tournamentId, bookingId } = await params;
  const { status } = await req.json();

  // Verify tournament belongs to this user
  const tournament = await prisma.savedTournament.findFirst({
    where: { id: tournamentId, userId: session.user.id },
  });
  if (!tournament)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.slotBooking.update({ 
    where: { id: bookingId },
    data: { status }
  });

  return NextResponse.json({ ok: true });
}

