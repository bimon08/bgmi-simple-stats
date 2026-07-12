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
