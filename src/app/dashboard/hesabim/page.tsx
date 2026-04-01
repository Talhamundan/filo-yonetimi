import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import HesabimClient from "./HesabimClient";

export default async function HesabimPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/auth/login");
  }

  const hesap = await prisma.hesap.findUnique({
    where: { personelId: userId },
    select: { kullaniciAdi: true },
  });

  if (!hesap?.kullaniciAdi) {
    return (
      <div className="mx-auto w-full max-w-[860px] p-6 md:p-8 xl:p-10">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Hesabınıza ait giriş bilgisi bulunamadı. Lütfen yönetici ile iletişime geçin.
        </div>
      </div>
    );
  }

  return <HesabimClient kullaniciAdi={hesap.kullaniciAdi} />;
}
