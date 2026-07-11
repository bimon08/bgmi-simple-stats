import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

function makeShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = makeShortCode();
    const exists = await prisma.savedTournament.findUnique({ where: { shortCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique code");
}

// POST /api/tournaments/[id]/share — generate a share token + short code
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await prisma.savedTournament.findFirst({ where: { id, userId: session.user.id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = row.shareToken ?? crypto.randomUUID();
  const shortCode = row.shortCode ?? await uniqueCode();

  await prisma.savedTournament.update({ where: { id }, data: { shareToken: token, shortCode } });

  return NextResponse.json({ token, shortCode });
}
