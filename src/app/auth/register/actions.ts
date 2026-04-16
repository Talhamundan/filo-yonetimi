"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { OnayDurumu, Rol } from "@prisma/client"

export async function registerUser(formData: any) {
    try {
        const { ad, soyad, eposta, sifre, telefon, tcNo, sirketId, rolTalebi } = formData

        if (!ad || !soyad || !eposta || !sifre || !sirketId) {
            return { success: false, error: "Gerekli alanları doldurunuz." }
        }

        // E-posta kontrolü
        const existing = await (prisma as any).kullanici.findUnique({
            where: { eposta }
        })

        if (existing) {
            return { success: false, error: "Bu e-posta adresi zaten kullanımda." }
        }

        // Şifre hashleme
        const hashedSifre = await bcrypt.hash(sifre, 10)

        // Kullanıcı oluşturma
        await (prisma as any).kullanici.create({
            data: {
                ad,
                soyad,
                eposta,
                sifre: hashedSifre,
                telefon,
                tcNo,
                sirketId,
                rol: (rolTalebi as Rol) || Rol.PERSONEL,
                onayDurumu: OnayDurumu.BEKLIYOR
            }
        })

        return { success: true }
    } catch (error: any) {
        console.error("Register error:", error)
        return { success: false, error: error.message || "Bir hata oluştu." }
    }
}
