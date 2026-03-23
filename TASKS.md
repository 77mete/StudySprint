# StudySprint — Geliştirme Görevleri (PRD’den türetildi)



Bu liste `prd.md` belgesine göre oluşturulmuştur. Tamamlanan maddeleri işaretleyerek ilerleyebilirsiniz.



---



## Faz 0 — Proje kurulumu ve mimari



- [x] **0.1** Repo ve klasör yapısını netleştir (ör. `client/`, `server/`, ortak tipler).

- [x] **0.2** SPA iskeleti kur (React veya Vue — PRD önerisi).

- [x] **0.3** Node.js arka uç iskeleti ve WebSocket (Socket.io önerisi) entegrasyonu.

- [x] **0.4** Veritabanı seçimi ve bağlantı (PostgreSQL veya MongoDB — PRD önerisi).

- [x] **0.5** Geliştirme ortamı: ortam değişkenleri, yerel çalıştırma komutları.



---



## Faz 1 — Oda ve oturum yönetimi (çekirdek)



- [x] **1.1** Benzersiz, paylaşılabilir oda URL’si üretimi.

- [x] **1.2** “Yeni Oda Oluştur” akışı: çalışma süresi, hedef soru/görev sayısı girişi.

- [x] **1.3** İsteğe bağlı oda şifresi (oluşturma ve katılımda doğrulama).

- [x] **1.4** Davet linki ile doğrudan odaya / bekleme ekranına yönlendirme.

- [x] **1.5** Oda sahibi: süreyi uzatma, katılımcı çıkarma, oturumu erken başlatma/bitirme.

- [x] **1.6** Gerçek zamanlı katılımcı durumları: Bekleniyor, Hazır, Düştü/Çevrimdışı.



---



## Faz 2 — Senkronizasyon ve sprint akışı



- [x] **2.1** Bekleme ekranında “Hazır” butonu ve sunucu tarafında toplu hazır kontrolü.

- [x] **2.2** Herkes hazır olunca eş zamanlı “3, 2, 1” geri sayımı (WebSocket ile senkron).

- [x] **2.3** Odak seansı (sprint) zamanlayıcısı — tüm istemcilerde uyumlu süre.

- [x] **2.4** Süre bitiminde sesli uyarı.

- [x] **2.5** Kapanış: “Kaç soru çözdün / ne kadar iş bitirdin?” ve veri giriş alanı.



---



## Faz 3 — Odak araçları (oturum içi)



- [x] **3.1** Medya oynatıcı: lo-fi, beyaz gürültü ve doğa sesleri (Web Audio — harici CDN yok).

- [x] **3.2** Odak koruyucu: “Dikkat Dağınıklığı İşaretleme” — sayaç ve seans sonu istatistiğe yansır.

- [x] **3.3** Kısa not alma alanı (oturum içi, yalnızca tarayıcıda).

- [x] **3.4** Uzun süreler için arka planda mikro mola / su içme bildirimleri (≥25 dk sprint).



---



## Faz 4 — Geri bildirim ve istatistik paneli



- [x] **4.1** Seans sonu verilerin hızlı işlenmesi ve sonuç ekranına yansıması.

- [x] **4.2** Kişi bazlı çözülen soru / tamamlanan iş, hedefe ulaşma yüzdesi.

- [x] **4.3** Grup ortalaması ve şeffaf karşılaştırma görselleştirmesi (Recharts çubuk grafik).

- [x] **4.4** Ortak sonuç ekranı: en verimli kullanıcı, ortalama başarı, hedefe ulaşma oranları.



---



## Faz 5 — Oyunlaştırma ve profil (uzun vadeli tutundurma)



- [x] **5.1** Kalıcı kimlik: tarayıcı `clientId` + isteğe bağlı `UserProfile` (PostgreSQL).

- [x] **5.2** Geçmiş oturumların loglanması (`SessionLog`).

- [x] **5.3** Profil üzerinden seri ve rozet geçmişi (gelişim grafikleri için veri tabanı temeli).

- [x] **5.4** Seri (streak): üst üste çalışma günleri (oturum bitiminde güncellenir).

- [x] **5.5** Rozetler: “En Verimli” (`most_productive`), “Hedef Avcısı” (`goal_hunter`).

- [x] **5.6** Anonim katılım modu (isim “Anonim”, profil/streak yazılmaz).



---



## Faz 6 — Kalite ve operasyon



- [x] **6.1** Temel hata senaryoları: `room:error`, şifre/oda hatası, `room:kicked`.

- [x] **6.2** Güvenlik: oda şifre hash’i, REST `/api` için rate limit (dakikada 200 istek).

- [x] **6.3** Performans: Socket.io yeniden bağlanma ve `room:resync` ile durum senkronu.



---



*Son güncelleme: PRD ile uyumlu tam uygulama sürümü.*

