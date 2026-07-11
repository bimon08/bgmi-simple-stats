import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";
import { Tournament } from "@/lib/types";

// GET /api/tournaments — fetch all tournaments for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.savedTournament.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  const tournaments: Tournament[] = rows.map((r) => r.data as unknown as Tournament);
  return NextResponse.json({ tournaments });
}

// PUT /api/tournaments — upsert a batch of tournaments
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tournaments } = await req.json() as { tournaments: Tournament[] };
  if (!Array.isArray(tournaments)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await Promise.all(
    tournaments.map((t) =>
      prisma.savedTournament.upsert({
        where: { id: t.id },
        update: { data: t as object, userId: session.user!.id! },
        create: { id: t.id, userId: session.user!.id!, data: t as object },
      })
    )
  );

  return NextResponse.json({ ok: true, count: tournaments.length });
}
