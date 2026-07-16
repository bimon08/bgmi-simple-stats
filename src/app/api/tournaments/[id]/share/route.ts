import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

function makeShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

// POST /api/tournaments/[id]/share
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tournamentData = body.data;

  const row = await prisma.savedTournament.findFirst({ where: { id, userId: caller.userId } });

  // If token already exists, return immediately — no DB write needed
  if (row?.shareToken && row?.shortCode) {
    return NextResponse.json({ token: row.shareToken, shortCode: row.shortCode });
  }

  const token = row?.shareToken ?? crypto.randomUUID();
  const shortCode = row?.shortCode ?? await uniqueCode();

  if (row) {
    await prisma.savedTournament.update({
      where: { id },
      data: {
        shareToken: token,
        shortCode,
        ...(tournamentData ? { data: tournamentData } : {}),
      },
    });
  } else {
    await prisma.savedTournament.create({
      data: { id, userId: caller.userId, data: tournamentData ?? {}, shareToken: token, shortCode },
    });
  }

  return NextResponse.json({ token, shortCode });
}
