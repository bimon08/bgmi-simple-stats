import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

// GET /api/rules — fetch organiser's rules
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { rules: true } });
  return NextResponse.json({ rules: user?.rules ?? [] });
}

// PUT /api/rules — save organiser's rules
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rules } = await req.json();
  if (!Array.isArray(rules)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { rules: rules.filter((r: string) => r.trim()) },
    select: { rules: true },
  });
  return NextResponse.json({ rules: user.rules });
}
