"use server"

import { prisma } from "@/lib/prisma"
import { OnayDurumu, Rol } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"

async function assertAdmin() {
  const session = await auth()
  if (!session?.user || (session.user as any).rol !== "ADMIN") {
    throw new Error("Bu işlem için yetkiniz yok.")
  }
}

export async function updateUserStatus(userId: string, status: OnayDurumu, role?: Rol) {
  try {
    await assertAdmin()

    await (prisma as any).kullanici.update({
      where: { id: userId },
      data: {
        onayDurumu: status,
        ...(role && { rol: role })
      }
    })
    revalidatePath("/dashboard/onay-merkezi")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
