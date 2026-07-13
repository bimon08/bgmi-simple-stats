import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// PATCH /api/pay/[token]/name — player self-updates their display name
// Only allows simple English letters, numbers, and spaces for searchability.
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { name } = await req.json() as { name: string };

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Only allow simple English: letters, digits, spaces
  const clean = name.trim();
  if (!/^[a-zA-Z0-9 ]+$/.test(clean)) {
    return NextResponse.json({ error: "Only English letters, numbers and spaces allowed" }, { status: 400 });
  }

  const wallet = await prisma.wallet.findUnique({ where: { shareToken: token } });
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.wallet.update({
    where: { id: wallet.id },
    data: { playerName: clean },
  });

  return NextResponse.json({ ok: true, playerName: updated.playerName });
}
