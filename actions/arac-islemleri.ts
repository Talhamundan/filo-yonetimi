"use server"

// @/lib/prisma yerine göreceli yolu kullanarak hatayı bitiriyoruz
import prisma from "../lib/prisma"
import { revalidatePath } from "next/cache"

export async function aracEkle(formData: FormData) {
  const plaka = formData.get("plaka") as string
  const marka = formData.get("marka") as string
  const model = formData.get("model") as string
  const yil = parseInt(formData.get("yil") as string)
  const bulunduguIl = formData.get("bulunduguIl") as string

  try {
    await prisma.arac.create({
      data: {
        plaka,
        marka,
        model,
        yil,
        bulunduguIl,
        durum: "AKTIF"
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