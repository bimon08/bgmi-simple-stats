import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@root/auth";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const txn = await prisma.transaction.findFirst({
    where: { id },
    include: { wallet: { select: { userId: true } } },
  });
  if (!txn || txn.wallet.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete transaction + reverse its effect on balance atomically
  await prisma.$transaction([
    prisma.transaction.delete({ where: { id } }),
    prisma.wallet.update({ where: { id: txn.walletId }, data: { balance: { decrement: txn.amount } } }),
  ]);

  return NextResponse.json({ ok: true });
}
