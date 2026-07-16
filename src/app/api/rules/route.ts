import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

// GET /api/rules — fetch organiser's rules
export async function GET(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: caller.userId }, select: { rules: true } });
  return NextResponse.json({ rules: user?.rules ?? [] });
}

// PUT /api/rules — save organiser's rules
export async function PUT(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rules } = await req.json();
  if (!Array.isArray(rules)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const user = await prisma.user.update({
    where: { id: caller.userId },
    data: { rules: rules.filter((r: string) => r.trim()) },
    select: { rules: true },
  });
  return NextResponse.json({ rules: user.rules });
}
