# MVP Backlog (PRD -> User Stories)

## MVP Hedefi
Sosyal yardimlasma/bagis akisini; guvenli, anonim ve kontrollu bir sekilde end-to-end calisan bir akisa indirmek.

## MVP Kapsaminda Olanlar
- Kullanici kayit/oturum, rol bazli yetkilendirme (Bagisci, Ihtiyac Sahibi, Admin)
- Bagisci tarafindan ilan olusturma (kategori + aciklama + goruntu)
- Ihtiyac sahibi tarafindan basvuru/ilan talebi (admin onayi gerektirir)
- Bagisci tarafindan aday secimi ve surec durumunun kaydi
- Kontrollu mesajlasma (sadece ilgili surec icinde)
- Kargo gonderi kodu uretimi (MVP'de entegrasyon yerine adaptore bagli "kod uret" stabi)
- Surec durumlari: "Kargoya Verildi" ve "Teslim Aldim" onayi
- Puanlama (tamamlanan islem sonrasi)
- Haftalik talep limiti: Ihtiyac Sahibi icin haftada en fazla 2 urun talebi
- KVKK uyumu icin anonimlik kurallari ve audit loglari (admin harici taraflarin PII gorememesi)

## MVP Disinda (Bu asamaya almayacagiz)
- Gercek kargo firmasi API entegrasyonlari (PTT/Aras/Yurtici) disaridan baglanacak; MVP'de tek noktali adaptore stub ile devam
- Gelismis dolandiricilik makine ogrenmesi/otomasyon kurallari (sezgisel/senaryo bazli kurallar ile baslanir)
- Genis raporlama/istatistik ekranlari (sadece temel admin loglari)

## Roller ve Yetkiler (Ozet)
- Bagisci: ilan olustur, basvurulari gor, anonim aday sec, surec durumunu ilerlet, puanla
- Ihtiyac Sahibi: belge yukle, admin onayi bekle, ilana basvur, kontrollu mesajlasma yap, teslim onayi, puanla
- Admin: belge onayi/reddi, sahte kullanici/ilan engelleme, itiraz/sikayet inceleme, audit loglari

---

## User Stories ve Kabul Kriterleri

### US-001: Rol Bazli Kayit ve Yetkilendirme
**Kime:** Tum kullanicilar  
**Ne:** Kayit olur, rol alir; is yetkisi kontrol edilir.  
**Neden:** Guvenli akses ve surec uyumu icin.

**Kabul Kriterleri**
- Kullanici kayit oldugunda sistem rol akisini baslatir (Ihtiyac Sahibi ve Bagisci ayri profil/akun durumlari)
- Yetki kontrolu sunucu tarafinda dogrulanir (frontend sadece UI'dir)
- Admin harici kullanicilar admin ekranlarina ulasamaz (route/handler korumasi)

### US-002: Admin Onayi Gereken Ihtiyac Sahibi Kaydi
**Kime:** Ihtiyac Sahibi  
**Ne:** Ogrenci belgesi/gelir durumu gibi evraklari yukler; admin onaylar.  
**Neden:** Kotu niyet ve yanlis talep riskini azaltmak.

**Kabul Kriterleri**
- Ihtiyac Sahibi kaydi "Onay Bekliyor" durumda baslar
- Admin onayi olmadan ilan basvurusu yapilamaz
- Admin onayi reddinde kullaniciya surec durumu kaydi tutulur

### US-003: Bagisci Ilan Olusturma (Kategori + Goruntu)
**Kime:** Bagisci  
**Ne:** Kategori secerek ilan olusturur.  
**Neden:** Dogru esya turunde talep toplamak.

**Kabul Kriterleri**
- Bagisci en az 1 goruntu ve zorunlu alanlari ile ilan olusturur (kategori, aciklama)
- Ilan olusturma sonrasinda ilan durumu "Aktif"
- Ilan guncelleme/silme yetkisi Bagisciye baglidir

### US-004: Ihtiyac Sahibi Ilana Basvuru
**Kime:** Ihtiyac Sahibi  
**Ne:** Ilana basvuru yapar.  
**Neden:** Bagisciye aday havuzu saglamak.

**Kabul Kriterleri**
- Ihtiyac Sahibi admin onayi olmadan basvuru yapamaz
- Ihtiyac Sahibi ayni hafta icinde en fazla 2 urun talebi yapabilir
- Basvuru kaydi olustugu anda surec durumu "Basvuru Alindi"

### US-005: Bagisci Aday Secimi (Anonim)
**Kime:** Bagisci  
**Ne:** Basvurular arasindan anonim bir aday secer.  
**Neden:** Kontrollu ve adil eslestirme.

**Kabul Kriterleri**
- Bagisci basvuru listesinden aday secer
- Secilen aday icin surec durumu "Aday Secildi"
- Bagisci, secilmis adayla ilgili PII (isim/TC/telefon/acik adres) goremez

### US-006: Surec Dosyalari ve Durum Isleyisi
**Kime:** Tum roller  
**Ne:** Surec durumlarini gorur ve dogru eylemleri yapar.  
**Neden:** Anlasilabilir ilerleme.

**Kabul Kriterleri**
- Surec icin izin verilen aksiyonlar durum bazli kontrol edilir
- Durum degisikligi audit log'a yazilir
- Kontrollu mesajlasma sadece "Aday Secildi" sonrasinda acilir

### US-007: Kontrollu Mesajlasma (Tam Anonim)
**Kime:** Bagisci + Ihtiyac Sahibi  
**Ne:** Surec kapsaminda mesajlasir.  
**Neden:** Taraflar birbirinin PII bilgisine ulasmasin.

**Kabul Kriterleri**
- Mesajlar sadece ilgili surece bagli olarak gorunur
- Kullanici sadece kendisine ait sureclerde mesaj gonderebilir/okuyabilir
- Sistem otomatik olarak mesaj icine eklenebilecek PII alanlarini engeller (en azindan ekran seviyesinde ve sunucu validasyonunda)

### US-008: Kargo Gonderi Kodu Uretimi (Adaptore Bagli)
**Kime:** Sistem + Bagisci/Admin  
**Ne:** Adres bilgisini arka planda kullanip kod uretir.  
**Neden:** Bagisci yalnizca kod verir; adres PII yayilmaz.

**Kabul Kriterleri**
- Surec "Kargoya Verildi" durumuna gecmeden once kod uretimi tetiklenir
- Kod uretildikten sonra Bagisci adres goremez, sadece "Kargo Kodu" gosterilir
- Kod unikal olur ve surece bagli saklanir
- Gercek kargo entegrasyonu icin bir adaptor arayuzu bulunur; MVP'de "fake provider" ile calisir

### US-009: Teslim Onayi
**Kime:** Ihtiyac Sahibi  
**Ne:** Paket teslim alindigini onaylar.  
**Neden:** Sureci tamamlamak icin.

**Kabul Kriterleri**
- Teslim onayi sadece dogru surec durumunda yapilabilir
- Teslim onayindan sonra puanlama asamasina gecilir
- Durum degisikligi audit log'a yazilir

### US-010: Puanlama (Geri bildirim ve guven skoru)
**Kime:** Bagisci + Ihtiyac Sahibi  
**Ne:** Tamamlanan surec sonrasi puan verir.  
**Neden:** Guven skorunun olusmasi.

**Kabul Kriterleri**
- Her iki taraf tamamlanan surec icin puan verebilir (birden fazla puan yok)
- Skor hesaplama kural seti temel seviyede tanimli olur (ornegin ortalama + tamamlanan islem sayisi agirliklari)
- Puanlama kaydi audit log'a yazilir

### US-011: Guven Skoru ve Otomatik Kisitlama (Baslangic)
**Kime:** Sistem/Admin  
**Ne:** Siklikle sahte/uyumsuz davranis tespit edilip otomatik kısıt uygulanir.  
**Neden:** Suiistimali azaltmak.

**Kabul Kriterleri**
- Baslangic rule seti tanimli olur (orn: teslim etmeden kapanan surecler, hizli iptal, coklu red vs.)
- Kisit uygulandiginda ilgili rol icin "basvuru/ilan/mesaj" aksiyonlari sinirlanir
- Kisit sebebi ve kapsam audit log'da yer alir

### US-012: Admin Moderasyon (Sahte Ilan/Kullanici Engelleme)
**Kime:** Admin  
**Ne:** Engelleme ve belge onaylarini yonetir.  
**Neden:** Guvenlik.

**Kabul Kriterleri**
- Admin belge onayi/reddi yapabilir
- Admin sahte ilan/kullanici engeller; etkilenen surec ve aksiyonlar kesilir
- Engelleme kararinin gerekcesi kayitlanir (zorunlu alan)

---

## Teknik/Guvenlik Kabul Kriterleri (Tum MVP icin)
- Anonimlik: Taraflar arasinda PII alanlar asla paylasilmaz (UI + API seviyesi)
- KVKK: Hassas alanlar (isim/TC/telefon/adres) en azindan uygulama seviyesinde sunucu tarafinda sifrelenerek saklanir
- Yetkilendirme: Tanimli rollerin disindaki tum handler'lar 403 dondurur
- Audit Log: Surec durumu, admin kararlar, puanlama ve kod uretimi loglanir

