# StudySprint - Ürün Gereksinimleri Belgesi (PRD)

## 1. Ürün Vizyonu ve Özeti
**StudySprint**, öğrencilerin yalnızlık ve dikkat dağınıklığı problemlerini çözmek için tasarlanmış, gerçek zamanlı ve tek sayfa mimarisine (SPA) sahip modern bir web uygulamasıdır. Kullanıcıların ortak bir zamanlayıcı etrafında toplanarak, odaklanma müzikleri ve verimlilik araçlarıyla desteklenmiş senkronize çalışma seansları düzenlemelerini sağlar. Uygulama, çalışma bitiminde katılımcıların verilerini şeffaf ve motive edici bir istatistik paneliyle sunarak sosyal motivasyonu artırır.

## 2. Kullanıcı Akışı (User Flow)
Kullanıcının uygulamaya girdiği andan, çalışma seansını bitirdiği ana kadar geçeceği adımlar:

1. **Oda Kurulumu:** Kullanıcı uygulamaya girer. "Yeni Oda Oluştur"a tıklar. Çalışma süresini (örn. 40 dk) ve hedef soru/görev sayısını girer. *(İsteğe bağlı: Oda şifresi belirler).*
2. **Davet ve Katılım:** Sistem özel bir URL (link) üretir. Kurucu bu linki arkadaşlarıyla paylaşır. Katılımcılar linke tıklayarak doğrudan odaya (bekleme ekranına) dahil olurlar.
3. **Senkronizasyon (Hazır Olma):** Odadaki herkes kendi ekranındaki "Hazır" butonuna basar. Sistem herkesin hazır olduğunu algıladığında ekranda eş zamanlı bir "3, 2, 1" geri sayımı başlar.
4. **Odak Seansı (Sprint):** Süre başlar. Kullanıcılar dış dünyadan izole edilir. Ekrandaki araç kutusundan müzik açabilir, dikkat dağınıklığını not edebilir veya mini notlar alabilirler.
5. **Kapanış ve Veri Girişi:** Süre bitiminde sesli bir uyarı çalar. Ekranda "Kaç soru çözdün/Ne kadar iş bitirdin?" sorusu ve bir girdi alanı belirir.
6. **Analiz ve Liderlik Tablosu:** Herkes verisini girdikten sonra, ortak bir sonuç ekranı belirir. En verimli kullanıcı, ortalama başarı ve hedefe ulaşma oranları gösterilir.

## 3. Temel Özellikler ve Modüller

### A. Oda ve Oturum Yönetimi (Core)
* **Bağlantı Üretimi:** Benzersiz ve paylaşılabilir oda linkleri oluşturma.
* **Oda Sahibi Kontrolleri:** Oda sahibinin süreyi uzatabilmesi, katılımcıları çıkarabilmesi veya oturumu erken başlatıp/bitirebilmesi.
* **Gerçek Zamanlı Durum:** Katılımcıların "Bekleniyor", "Hazır", "Düştü/Çevrimdışı" durumlarının anlık gösterimi.

### B. Odaklanma Araçları (In-Session)
* **Medya Oynatıcı:** Yalnızca o kullanıcıya özel çalışan, dışa bağımlı olmayan lo-fi, beyaz gürültü ve doğa sesleri listesi.
* **Odak Koruyucu:** "Dikkat Dağınıklığı İşaretleme" butonu (kullanıcı her bölündüğünde basar, sonda istatistiğe yansır) ve kısa not alma alanı.
* **Hatırlatıcılar:** Süre uzunsa arka planda çalışan "mikro mola / su içme" bildirimleri.

### C. Geri Bildirim ve İstatistik Paneli
* **Anlık Veri İşleme:** Seans sonu girilen verilerin saniyeler içinde grafiğe dökülmesi.
* **Şeffaf Karşılaştırma:** Kişi bazlı çözülen soru sayısı, hedefe ulaşma yüzdesi ve grup ortalamasının görselleştirilmesi.

### D. Oyunlaştırma ve Profil (Uzun Vadeli Tutundurma)
* **Gelişim Grafikleri:** Kullanıcının geçmiş oturumlarının loglanması ve zaman içindeki gelişimini gösteren grafikler.
* **Rozet ve Seri (Streak):** Üst üste çalışma günleri için seriler ve "En Verimli", "Hedef Avcısı" gibi otomatik tanımlanan rozetler.
* **Gizlilik:** İsteyen katılımcılar için anonim katılma modu.

## 4. Teknik Altyapı Özeti
Bu uygulamayı hayata geçirmek için üç temel yapı taşına ihtiyaç vardır:

* **Ön Yüz (Tek Sayfa Mimarisi - SPA):** Uygulamanın sayfalar arası geçiş yaparken ekranın yenilenmediği, her şeyin akıcı ve tek bir uygulama penceresinde gibi çalıştığı yapı. *(Tavsiye: React veya Vue.js)*
* **Arka Yüz ve Anlık İletişim (WebSocket):** Herkesin aynı anda aynı geri sayımı görmesi, "Hazır" butonuna basıldığında herkesin ekranının aynı anda güncellenmesi için standart web istekleri yerine, sunucuyla sürekli açık kalan düşük gecikmeli bir iletişim hattı. *(Tavsiye: Node.js ve Socket.io)*
* **Veritabanı:** Geçmiş istatistikleri, streak'leri ve kullanıcı hesaplarını güvenli ve kontrollü tutacağımız, hızlı yanıt veren bir sistem. *(Tavsiye: PostgreSQL veya MongoDB)*