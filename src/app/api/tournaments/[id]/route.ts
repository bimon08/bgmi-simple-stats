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


  return NextResponse.json({ ok: true, isActive: updated.isActive, entryFee: updated.entryFee });
}
