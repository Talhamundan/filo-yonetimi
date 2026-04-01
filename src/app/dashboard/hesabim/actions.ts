"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { logEntityActivity } from "@/lib/activity-log";

type ActorUser = {
  id: string;
  rol: string;
  sirketId?: string | null;
};

async function assertAuthenticated() {
  const session = await auth();
  const user = session?.user as ActorUser | undefined;
  if (!user?.id) {
    throw new Error("Oturum bulunamadı.");
  }
  return user;
}

export async function changeOwnPassword(data: {
  mevcutSifre: string;
  yeniSifre: string;
  yeniSifreTekrar: string;
}) {
  try {
    const actor = await assertAuthenticated();
    const mevcutSifre = data.mevcutSifre || "";
    const yeniSifre = data.yeniSifre || "";
    const yeniSifreTekrar = data.yeniSifreTekrar || "";

    if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
      return { success: false, error: "Tüm şifre alanlarını doldurmanız gerekiyor." };
    }

    if (yeniSifre !== yeniSifreTekrar) {
      return { success: false, error: "Yeni şifre ve tekrar alanı birbiriyle aynı olmalıdır." };
    }

    if (yeniSifre.length < 6) {
      return { success: false, error: "Yeni şifre en az 6 karakter olmalıdır." };
    }

    if (mevcutSifre === yeniSifre) {
      return { success: false, error: "Yeni şifre, mevcut şifreden farklı olmalıdır." };
    }

    const hesap = await prisma.hesap.findUnique({
      where: { personelId: actor.id },
      select: {
        id: true,
        kullaniciAdi: true,
        sifreHash: true,
        aktifMi: true,
      },
    });

    if (!hesap || !hesap.aktifMi) {
      return { success: false, error: "Aktif bir kullanıcı hesabı bulunamadı." };
    }

    const isCurrentPasswordValid = await bcrypt.compare(mevcutSifre, hesap.sifreHash);
    if (!isCurrentPasswordValid) {
      return { success: false, error: "Mevcut şifrenizi hatalı girdiniz." };
    }

    const yeniSifreHash = await bcrypt.hash(yeniSifre, 10);

    await prisma.hesap.update({
      where: { id: hesap.id },
      data: { sifreHash: yeniSifreHash },
    });

    await logEntityActivity({
      actionType: ActivityActionType.UPDATE,
      entityType: ActivityEntityType.KULLANICI,
      entityId: actor.id,
      summary: "Kullanıcı kendi şifresini güncelledi.",
      actor,
      companyId: actor.sirketId || null,
      metadata: {
        kullaniciAdi: hesap.kullaniciAdi,
      },
    });

    revalidatePath("/dashboard/hesabim");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Şifre güncellenemedi.";
    return { success: false, error: message };
  }
}
