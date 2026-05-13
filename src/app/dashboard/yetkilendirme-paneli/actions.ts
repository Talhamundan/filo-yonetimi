"use server"

import { prisma } from "@/lib/prisma"
import { ActivityActionType, ActivityEntityType, OnayDurumu, Prisma, Rol } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { logEntityActivity } from "@/lib/activity-log"
import bcrypt from "bcryptjs"
import { resolveActionSirketId } from "@/lib/action-scope"
import { approveAdminApprovalRequest, rejectAdminApprovalRequest } from "@/lib/admin-approval"

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

const YAKIT_TANK_HAS_SIRKET_FIELD = Boolean(
  (prisma as any)?._runtimeDataModel?.models?.YakitTank?.fields?.some((field: any) => field?.name === "sirketId") ||
  Prisma.dmmf.datamodel.models
    .find((model) => model.name === "YakitTank")
    ?.fields.some((field) => field.name === "sirketId")
)

export async function approvePendingMutationRequest(id: string) {
  const result = await approveAdminApprovalRequest(id)
  if (result.success) {
    revalidatePath("/dashboard/yetkilendirme-paneli")
    revalidatePath("/dashboard")
  }
  return result
}

export async function rejectPendingMutationRequest(id: string) {
  const result = await rejectAdminApprovalRequest(id)
  if (result.success) {
    revalidatePath("/dashboard/yetkilendirme-paneli")
  }
  return result
}

export async function createUserAccount(data: {
  personelId: string
  kullaniciAdi: string
  sifre: string
}) {
  try {
    const actor = await assertAdmin()
    const personelId = data.personelId.trim()
    const username = data.kullaniciAdi.trim().toLowerCase()
    const password = data.sifre.trim()

    if (!personelId || !username || !password) {
      return { success: false, error: "Personel, personel giriş adı ve şifre zorunludur." }
    }

    const existing = await prisma.hesap.findUnique({
      where: { kullaniciAdi: username },
      select: { id: true },
    })
    if (existing) {
      return { success: false, error: "Bu personel giriş adı zaten kullanımda." }
    }

    const personel = await prisma.kullanici.findUnique({
      where: { id: personelId },
      select: {
        id: true,
        ad: true,
        soyad: true,
        rol: true,
        sirketId: true,
        hesap: {
          select: {
            id: true,
          },
        },
        deletedAt: true,
      },
    })
    if (!personel || personel.deletedAt) {
      return { success: false, error: "Personel bulunamadı." }
    }
    if (personel.rol === Rol.PERSONEL) {
      return { success: false, error: "Personel rolündeki kullanıcı için giriş hesabı tanımlanamaz." }
    }
    if (personel.hesap) {
      return { success: false, error: "Bu personele zaten giriş hesabı tanımlı." }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const created = await prisma.$transaction(async (tx) => {
      const updatedPersonel = await tx.kullanici.update({
        where: { id: personel.id },
        data: {
          onayDurumu: OnayDurumu.ONAYLANDI,
        },
        select: {
          id: true,
          ad: true,
          soyad: true,
          rol: true,
          sirketId: true,
        },
      })
      await tx.hesap.create({
        data: {
          personelId: personel.id,
          kullaniciAdi: username,
          sifreHash: hashedPassword,
        },
      })
      return updatedPersonel
    })

    await logEntityActivity({
      actionType: ActivityActionType.CREATE,
      entityType: ActivityEntityType.KULLANICI,
      entityId: created.id,
      summary: `${created.ad} ${created.soyad} personeline giriş hesabı tanımlandı.`,
      actor,
      companyId: created.sirketId || actor.sirketId || null,
      metadata: {
        rol: created.rol,
        kullaniciAdi: username,
      },
    })

    revalidatePath("/dashboard/yetkilendirme-paneli")
    revalidatePath("/dashboard/personel")
    revalidatePath("/dashboard/sirketler")
    return { success: true }
  } catch (error) {
    const errorCode =
      typeof error === "object" && error && "code" in error
        ? (error as { code?: string }).code
        : undefined

    if (errorCode === "P2002") {
      return { success: false, error: "Bu personel giriş adı zaten kullanımda." }
    }

    const message = error instanceof Error ? error.message : "Kayıt sırasında beklenmeyen bir hata oluştu."
    return { success: false, error: message }
  }
}

export async function updateUserStatus(userId: string, status: OnayDurumu, role?: Rol) {
  try {
    const actor = await assertAdmin()
    const previous = await prisma.kullanici.findUnique({
      where: { id: userId },
      select: { id: true, ad: true, soyad: true, rol: true, onayDurumu: true, sirketId: true },
    })
    if (!previous) {
      return { success: false, error: "Personel bulunamadı." }
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

    revalidatePath("/dashboard/yetkilendirme-paneli")
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Güncelleme sırasında beklenmeyen bir hata oluştu."
    return { success: false, error: message }
  }
}

export async function updateUserAccount(
  userId: string,
  data: { kullaniciAdi: string; sifre?: string; rol: Rol; yetkiliSirketIds?: string[] }
) {
  try {
    const actor = await assertAdmin()
    const username = data.kullaniciAdi.trim().toLowerCase()
    const nextPassword = (data.sifre || "").trim()
    const requestedYetkiliSirketIds = [...new Set((data.yetkiliSirketIds || []).map((id) => id.trim()).filter(Boolean))]

    if (!username) {
      return { success: false, error: "Personel giriş adı zorunludur." }
    }

    const existingByUsername = await prisma.hesap.findFirst({
      where: { kullaniciAdi: username, NOT: { personelId: userId } },
      select: { id: true },
    })
    if (existingByUsername) {
      return { success: false, error: "Bu personel giriş adı zaten kullanımda." }
    }

    const previous = await prisma.kullanici.findUnique({
      where: { id: userId },
      select: {
        id: true,
        ad: true,
        soyad: true,
        rol: true,
        sirketId: true,
        hesap: { select: { id: true, kullaniciAdi: true } },
        yetkiliSirketler: { select: { sirketId: true } },
      },
    })
    if (!previous) {
      return { success: false, error: "Personel bulunamadı." }
    }

    if (!previous.hesap && !nextPassword) {
      return { success: false, error: "Yeni hesap tanımlamak için şifre zorunludur." }
    }
    const hashedPassword = nextPassword ? await bcrypt.hash(nextPassword, 10) : null

    const updated = await prisma.$transaction(async (tx) => {
      const validSirketler = requestedYetkiliSirketIds.length
        ? await tx.sirket.findMany({ where: { id: { in: requestedYetkiliSirketIds } }, select: { id: true } })
        : []
      const validSirketIds = validSirketler.map((row) => row.id)
      const updatedPersonel = await tx.kullanici.update({
        where: { id: userId },
        data: { rol: data.rol },
        select: {
          id: true,
          ad: true,
          soyad: true,
          rol: true,
          sirketId: true,
        },
      })
      await tx.kullaniciYetkiliSirket.deleteMany({ where: { kullaniciId: userId } })
      if ((data.rol === Rol.YETKILI || data.rol === Rol.TEKNIK) && validSirketIds.length > 0) {
        await tx.kullaniciYetkiliSirket.createMany({
          data: validSirketIds.map((sirketId) => ({ kullaniciId: userId, sirketId })),
          skipDuplicates: true,
        })
      }
      if (previous.hesap) {
        await tx.hesap.update({
          where: { id: previous.hesap.id },
          data: {
            kullaniciAdi: username,
            ...(hashedPassword ? { sifreHash: hashedPassword } : {}),
          },
        })
      } else {
        await tx.hesap.create({
          data: {
            personelId: userId,
            kullaniciAdi: username,
            sifreHash: hashedPassword!,
          },
        })
      }
      return updatedPersonel
    })

    await logEntityActivity({
      actionType:
        previous.rol !== updated.rol ? ActivityActionType.ROLE_CHANGE : ActivityActionType.UPDATE,
      entityType: ActivityEntityType.KULLANICI,
      entityId: updated.id,
      summary: `${updated.ad} ${updated.soyad} personel hesabı güncellendi.`,
      actor,
      companyId: updated.sirketId || actor.sirketId || null,
      metadata: {
        oncekiRol: previous.rol,
        yeniRol: updated.rol,
        oncekiKullaniciAdi: previous.hesap?.kullaniciAdi || null,
        yeniKullaniciAdi: username,
        sifreGuncellendi: Boolean(nextPassword),
        oncekiYetkiliSirketIds: previous.yetkiliSirketler.map((row) => row.sirketId),
        yeniYetkiliSirketIds:
          data.rol === Rol.YETKILI || data.rol === Rol.TEKNIK ? requestedYetkiliSirketIds : [],
      },
    })

    revalidatePath("/dashboard/yetkilendirme-paneli")
    revalidatePath("/dashboard/personel")
    revalidatePath("/dashboard/sirketler")
    return { success: true }
  } catch (error) {
    const errorCode =
      typeof error === "object" && error && "code" in error
        ? (error as { code?: string }).code
        : undefined

    if (errorCode === "P2002") {
      return { success: false, error: "Bu personel giriş adı zaten kullanımda." }
    }

    const message = error instanceof Error ? error.message : "Personel güncellenemedi."
    return { success: false, error: message }
  }
}

export async function deleteUserAccount(userId: string) {
  try {
    const actor = await assertAdmin()

    if (actor.id === userId) {
      return { success: false, error: "Kendi hesabınızı buradan silemezsiniz." }
    }

    const personel = await prisma.kullanici.findUnique({
      where: { id: userId },
      select: {
        id: true,
        ad: true,
        soyad: true,
        sirketId: true,
        hesap: { select: { id: true, kullaniciAdi: true } },
      },
    })
    if (!personel) {
      return { success: false, error: "Personel bulunamadı." }
    }
    if (!personel.hesap) {
      return { success: false, error: "Bu personelin zaten giriş hesabı yok." }
    }

    await prisma.hesap.delete({ where: { id: personel.hesap.id } })

    await logEntityActivity({
      actionType: ActivityActionType.DELETE,
      entityType: ActivityEntityType.KULLANICI,
      entityId: personel.id,
      summary: `${personel.ad} ${personel.soyad} personelinin giriş hesabı kaldırıldı.`,
      actor,
      companyId: personel.sirketId || actor.sirketId || null,
      metadata: {
        kullaniciAdi: personel.hesap.kullaniciAdi,
      },
    })

    revalidatePath("/dashboard/yetkilendirme-paneli")
    revalidatePath("/dashboard/personel")
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Personel hesabı silinemedi."
    return { success: false, error: message }
  }
}

// Yakit Tanki Yonetimi
export async function createYakitTank(data: {
  ad: string
  sirketId?: string | null
  kapasiteLitre: number
  mevcutLitre: number
}) {
  try {
    const actor = await assertAdmin()
    const sirketId = YAKIT_TANK_HAS_SIRKET_FIELD ? await resolveActionSirketId(data.sirketId) : null
    const ad = data.ad.trim()
    if (!ad || data.kapasiteLitre <= 0 || (YAKIT_TANK_HAS_SIRKET_FIELD && !sirketId)) {
      return { success: false, error: "Tank adı, şirket ve geçerli kapasite zorunludur." }
    }

    const created = await (prisma as any).yakitTank.create({
      data: {
        ad,
        ...(YAKIT_TANK_HAS_SIRKET_FIELD && sirketId ? { sirket: { connect: { id: sirketId } } } : {}),
        kapasiteLitre: data.kapasiteLitre,
        mevcutLitre: data.mevcutLitre || 0,
        aktifMi: true,
      },
    })

    await logEntityActivity({
      actionType: ActivityActionType.CREATE,
      entityType: ActivityEntityType.DIGER,
      entityId: created.id,
      summary: `${created.ad} yakıt tankı sisteme tanımlandı.`,
      actor,
      companyId: (created as any).sirketId || sirketId || actor.sirketId || null,
      metadata: {
        sirketId: (created as any).sirketId || sirketId || null,
        kapasite: created.kapasiteLitre,
        baslangicLitre: created.mevcutLitre,
      },
    })

    revalidatePath("/dashboard/yetkilendirme-paneli")
    revalidatePath("/dashboard/yakitlar")
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tank eklenemedi."
    return { success: false, error: message }
  }
}

export async function updateYakitTank(id: string, data: {
  ad: string
  sirketId?: string | null
  kapasiteLitre: number
  mevcutLitre: number
  aktifMi: boolean
}) {
  try {
    const actor = await assertAdmin()
    const sirketId = YAKIT_TANK_HAS_SIRKET_FIELD ? await resolveActionSirketId(data.sirketId) : null
    const ad = data.ad.trim()
    if (!ad || data.kapasiteLitre <= 0 || (YAKIT_TANK_HAS_SIRKET_FIELD && !sirketId)) {
      return { success: false, error: "Tank adı, şirket ve geçerli kapasite zorunludur." }
    }

    const updated = await (prisma as any).yakitTank.update({
      where: { id },
      data: {
        ad,
        ...(YAKIT_TANK_HAS_SIRKET_FIELD && sirketId ? { sirket: { connect: { id: sirketId } } } : {}),
        kapasiteLitre: data.kapasiteLitre,
        mevcutLitre: data.mevcutLitre,
        aktifMi: data.aktifMi,
      },
    })

    await logEntityActivity({
      actionType: ActivityActionType.UPDATE,
      entityType: ActivityEntityType.DIGER,
      entityId: updated.id,
      summary: `${updated.ad} yakıt tankı güncellendi.`,
      actor,
      companyId: (updated as any).sirketId || sirketId || actor.sirketId || null,
      metadata: {
        sirketId: (updated as any).sirketId || sirketId || null,
        kapasite: updated.kapasiteLitre,
        mevcutLitre: updated.mevcutLitre,
        aktifMi: updated.aktifMi,
      },
    })

    revalidatePath("/dashboard/yetkilendirme-paneli")
    revalidatePath("/dashboard/yakitlar")
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tank güncellenemedi."
    return { success: false, error: message }
  }
}

export async function deleteYakitTank(id: string) {
  try {
    const actor = await assertAdmin()
    
    // Check if there are any movements related to this tank
    const movements = await prisma.yakitTankHareket.findFirst({
      where: {
        OR: [{ tankId: id }, { hedefTankId: id }],
      },
    })

    if (movements) {
      return { success: false, error: "Bu tanka ait hareket kayıtları bulunduğu için silinemez. Bunun yerine pasife alabilirsiniz." }
    }

    const deleted = await prisma.yakitTank.delete({ where: { id } })

    await logEntityActivity({
      actionType: ActivityActionType.DELETE,
      entityType: ActivityEntityType.DIGER,
      entityId: deleted.id,
      summary: `${deleted.ad} yakıt tankı sistemden silindi.`,
      actor,
      companyId: actor.sirketId || null,
    })

    revalidatePath("/dashboard/yetkilendirme-paneli")
    revalidatePath("/dashboard/yakitlar")
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tank silinemedi."
    return { success: false, error: message }
  }
}
