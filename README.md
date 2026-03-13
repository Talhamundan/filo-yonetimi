# 🚛 Filo Yönetim Sistemi (Fleet Management SaaS)

Profesyonel bir filo yönetim ve takip sistemi. Bu uygulama, araç envanterini, yakıt harcamalarını, cezaları, muayeneleri, HGS yüklemelerini ve personel atamalarını merkezi bir platform üzerinden yönetmenizi sağlar.

## 🚀 Öne Çıkan Özellikler

- **Dashboard**: Filo istatistikleri, aktif araç sayısı ve maliyet grafiklerini içeren kapsamlı özet ekranı.
- **Araç Yönetimi**: Araçların kategori (Binek, Kamyon/Tır, İş Makinesi), plaka, marka/model ve güncel durum (Aktif, Boşta, Serviste vb.) takibi.
- **Yakıt Takibi**: Litre bazlı yakıt alımı, istasyon bilgisi ve otomatik toplam tutar hesaplama.
- **Zimmet Sistemi**: Araçların şoförlere atanması ve geçmiş zimmet kayıtlarının takibi.
- **Maliyet Yönetimi**: Ceza, Muayene, HGS, Bakım, Sigorta ve Kasko giderlerinin detaylı yönetimi.
- **Doküman Yönetimi**: Ruhsat, sigorta ve fatura gibi belgelerin dijital arşivlenmesi.
- **Modern UI**: Tailwind CSS ve Shadcn UI ile güçlendirilmiş, karanlık mod destekli, duyarlı tasarım.
- **Bildirimler**: Sonner ile modernize edilmiş interaktif geri bildirimler.

## 🛠️ Teknoloji Yığını

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Dil**: TypeScript
- **Veritabanı & ORM**: PostgreSQL & [Prisma](https://www.prisma.io/)
- **Kimlik Doğrulama**: [NextAuth.js (Auth.js)](https://authjs.dev/)
- **UI & Styling**: Tailwind CSS, Shadcn UI, Lucide Icons
- **Bildirimler**: Sonner
- **Formlar**: React Hook Form

## 💻 Kurulum ve Çalıştırma

1. **Depoyu Klonlayın:**
   ```bash
   git clone [repo-url]
   cd filo-yonetimi
   ```

2. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```

3. **Ortam Değişkenlerini Ayarlayın:**
   `.env.example` dosyasını `.env` olarak kopyalayın ve kendi bilgilerinizle doldurun.
   ```bash
   cp .env.example .env
   ```

4. **Veritabanını Hazırlayın:**
   Prisma migration'larını çalıştırın ve istemciyi oluşturun:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Uygulamayı Başlatın:**
   ```bash
   npm run dev
   ```

## 📄 Lisans

Bu proje MIT lisansı ile lisanslanmıştır. Daha fazla bilgi için `LICENSE` dosyasına (varsa) bakabilirsiniz.
