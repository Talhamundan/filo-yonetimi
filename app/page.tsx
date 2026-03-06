import { aracEkle } from "@/actions/arac-islemleri";

export default function Home() {
  return (
    <main className="min-h-screen bg-white p-10 text-black">
      <div className="max-w-2xl mx-auto border p-8 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Filo Yönetim Sistemi - Araç Girişi</h1>

        {/* Form aksiyonunu doğrudan server action'a bağlıyoruz */}
        <form action={aracEkle} className="grid grid-cols-1 gap-4">
          <input name="plaka" placeholder="Plaka (Örn: 34ABC123)" className="border p-3 rounded text-black bg-gray-50" required />
          <div className="grid grid-cols-2 gap-4">
            <input name="marka" placeholder="Marka" className="border p-3 rounded text-black bg-gray-50" required />
            <input name="model" placeholder="Model" className="border p-3 rounded text-black bg-gray-50" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input name="yil" type="number" placeholder="Model Yılı" className="border p-3 rounded text-black bg-gray-50" required />
            <input name="bulunduguIl" placeholder="Şehir (İl)" className="border p-3 rounded text-black bg-gray-50" required />
          </div>

          <button type="submit" className="bg-blue-600 text-white p-4 rounded-lg font-bold hover:bg-blue-700 transition-colors">
            Aracı Veritabanına Kaydet
          </button>
        </form>
      </div>
    </main>
  );
}