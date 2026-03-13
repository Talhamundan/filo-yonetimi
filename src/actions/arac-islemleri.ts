"use server"

// @/lib/prisma yerine göreceli yolu kullanarak hatayı bitiriyoruz
import prisma from "../lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { getCurrentSirketId } from "@/lib/auth-utils"

export async function aracEkle(formData: FormData) {
  const session = await auth()
  const user = session?.user as any | undefined
  if (!user) {
    throw new Error("Oturum bulunamadı.")
  }

  const plaka = formData.get("plaka") as string
  const marka = formData.get("marka") as string
  const model = formData.get("model") as string
  const yil = parseInt(formData.get("yil") as string)
  const bulunduguIl = formData.get("bulunduguIl") as string

  try {
    const sirketId = await getCurrentSirketId()

    await prisma.arac.create({
      data: {
        plaka,
        marka,
        model,
        yil,
        bulunduguIl: bulunduguIl as any,
        durum: "AKTIF",
        sirketId: sirketId || null
      }
    })

    // ÖNEMLİ: Fonksiyon hiçbir şey return etmemeli (Promise<void>) 
    // Bu sayede page.tsx'teki form action hatası düzelir.
    revalidatePath("/")
  } catch (error) {
    console.error("Kayıt sırasında hata oluştu:", error)
    // Hata olsa bile tip hatası almamak için return etmiyoruz
  }
}