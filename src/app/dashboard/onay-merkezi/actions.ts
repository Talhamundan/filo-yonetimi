"use server"

import { prisma } from "@/lib/prisma"
import { ActivityActionType, ActivityEntityType, OnayDurumu, Rol } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { logEntityActivity } from "@/lib/activity-log"

type ActorUser = {
  id: string
  rol: string
  sirketId?: string | null
}

async function assertAdmin() {
  const session = await auth()
  const user = session?.user as ActorUser | undefined
  if (!user || user.rol !== "ADMIN") {
    throw new Error("Bu işlem için yetkiniz yok.")
  }
  return user
}

export async function updateUserStatus(userId: string, status: OnayDurumu, role?: Rol) {
  try {
    const actor = await assertAdmin()
    const previous = await prisma.kullanici.findUnique({
      where: { id: userId },
      select: { id: true, ad: true, soyad: true, rol: true, onayDurumu: true, sirketId: true },
    })
    if (!previous) {
      return { success: false, error: "Kullanıcı bulunamadı." }
    }

    const updated = await prisma.kullanici.update({
      where: { id: userId },
      data: {
        onayDurumu: status,
        ...(role && { rol: role })
      }
    })

    const roleChanged = Boolean(role && previous.rol !== updated.rol)
    await logEntityActivity({
      actionType: roleChanged ? ActivityActionType.ROLE_CHANGE : ActivityActionType.STATUS_CHANGE,
      entityType: ActivityEntityType.KULLANICI,
      entityId: updated.id,
      summary: roleChanged
        ? `${updated.ad} ${updated.soyad} için rol güncellendi.`
        : `${updated.ad} ${updated.soyad} için onay durumu güncellendi.`,
      actor,
      companyId: updated.sirketId || actor.sirketId || null,
      metadata: {
        oncekiRol: previous.rol,
        yeniRol: updated.rol,
        oncekiOnayDurumu: previous.onayDurumu,
        yeniOnayDurumu: updated.onayDurumu,
      },
    })

    revalidatePath("/dashboard/onay-merkezi")
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Güncelleme sırasında beklenmeyen bir hata oluştu."
    return { success: false, error: message }
  }
}
