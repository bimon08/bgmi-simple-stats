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

// POST /api/tournaments/[id]/share — upserts latest tournament data + generates share token/code
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tournamentData = body.data; // latest data from client

  const row = await prisma.savedTournament.findFirst({ where: { id, userId: session.user.id } });

  const token = row?.shareToken ?? crypto.randomUUID();
  const shortCode = row?.shortCode ?? await uniqueCode();

  if (row) {
    await prisma.savedTournament.update({
      where: { id },
      data: {
        shareToken: token,
        shortCode,
        // Always update data so share reflects the latest version
        ...(tournamentData ? { data: tournamentData } : {}),
      },
    });
  } else {
    // First time syncing this tournament
    await prisma.savedTournament.create({
      data: { id, userId: session.user.id, data: tournamentData ?? {}, shareToken: token, shortCode },
    });
  }

  return NextResponse.json({ token, shortCode });
}
