# Ürün Gereksinim Belgesi (PRD): Sosyal Yardımlaşma ve Bağış Platformu

## 1. Ürün Vizyonu ve Amacı
Bu platform; kullanılabilir durumdaki eşyalarını bağışlamak isteyen bireyler ile bu eşyalara gerçekten ihtiyacı olan kişileri **güvenli, anonim ve kontrollü** bir ortamda buluşturan bir köprüdür. Öncelik; suiistimalleri engellemek, veri gizliliğini (KVKK uyumu) maksimum seviyede tutmak ve yardımlaşmayı dijitalleştirerek güvenilir hale getirmektir.

---

## 2. Kullanıcı Rolleri ve Yetkileri

| Rol | Tanım | Temel Yetkiler |
| :--- | :--- | :--- |
| **Bağışçı** | Eşyasını vermek isteyen kullanıcı. | İlan oluşturma, başvuranı seçme, kargo kodu alma, puanlama. |
| **İhtiyaç Sahibi** | Eşya talebinde bulunan kullanıcı. | Belge yükleyerek kayıt olma, ilan filtreleme, haftada maks. 2 başvuru yapma. |
| **Yönetici (Admin)** | Sistemin güvenliğini sağlayan kontrolör. | Belge onayı, sahte ilan/kullanıcı engelleme, itiraz yönetimi. |

---

## 3. Temel Özellikler (Kapsam)

### A. Bağışçı Modülü
* **İlan Yönetimi:** Fotoğraf yükleme, açıklama yazma ve doğru kategoriyi (giysi, kitap, elektronik vb.) seçerek ilan açma.
* **Aday Değerlendirme:** İlanına başvuran ihtiyaç sahiplerini anonim profilleri ve güven skorları üzerinden değerlendirip seçim yapma.

### B. İhtiyaç Sahibi Modülü
* **Doğrulanmış Kayıt:** Sisteme kayıt olurken öğrenci belgesi, gelir durumu gibi evrakların yüklenmesi (Yönetici onayına tabidir).
* **Akıllı Filtreleme ve Arama:** Kategoriye veya ihtiyaca göre hızlı arama.
* **Adil Kullanım Limiti:** Kötü niyetli kullanımı engellemek için haftalık maksimum **2 ürün** talep edebilme kısıtlaması.

### C. Güvenlik, Gizlilik ve Sistem Modülleri
* **Tam Anonimlik (KVKK Uyumu):** Kullanıcıların Ad, Soyad, TC Kimlik, Telefon ve Açık Adres bilgileri asla birbirlerine gösterilmez. 
* **Güvenli İletişim:** Taraflar sadece sistemin içindeki "Kontrollü Mesajlaşma" modülü üzerinden yazışabilir.
* **Güven Skoru Sistemi:** Tamamlanan işlem sonrası tarafların birbirine verdiği puanlarla hesaplanan skor. Şüpheli hesaplar otomatik kısıtlanır.
* **Kargo Entegrasyonu:** Adres bilgileri arka planda işlenir. Bağışçı kargo şubesine sadece sistemin ürettiği (Örn: PTT/Aras/Yurtiçi) kodu verir.

---

## 4. Adım Adım İşlem Akışı (Kullanıcı Senaryosu)

1. **İlanın Açılması:** Bağışçı, sisteme giriş yapar ve bağışlayacağı eşyanın detaylarını girerek ilan oluşturur.
2. **Başvuru:** Yönetici onayından geçmiş ihtiyaç sahibi, ilanı inceler ve "Talep Et" butonuna basar.
3. **Seçim:** Bağışçı, gelen talepler arasından (anonim olarak) bir kişiyi seçer ve onaylar.
4. **Kargo Kodunun Üretilmesi:** Sistem, adres bilgilerini harmanlayarak bir **Kargo Gönderi Kodu** oluşturur.
5. **Kargolama:** Bağışçı paketi kargoya verir ve sadece kodu söyler. "Kargoya Verildi" bildirimi taraflara iletilir.
6. **Teslimat:** İhtiyaç sahibi paketi teslim aldığında sistemde "Teslim Aldım" işlemini onaylar.
7. **Puanlama:** İki taraf süreci değerlendirip puan verir ve işlem tamamlanır.

---

## 5. Teknik Yol Haritası

* **Önyüz (Frontend):** Mobil uyumlu, kullanıcı dostu arayüz.
* **Arkayüz (Backend):** Kargo API entegrasyonu, limit kontrolleri, anonimleştirme ve mesajlaşma servisleri.
* **Veritabanı (Database):** Kullanıcı verilerinin, belgelerin ve işlem loglarının şifrelenerek tutulacağı güvenli yapı.