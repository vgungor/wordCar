# Yazma Yarışı — GitHub Pages sürümü

Sadece HTML, CSS ve JavaScript. Sunucu ya da veritabanı gerekmez. 5 öğrenci aynı Türkçe metni yazarak yarışır; her öğrencinin arabası doğru yazdığı karakter kadar ilerler.

## Nasıl çalışır?
- **Öğretmen** `ogretmen.html` sayfasını açar. Bu sekme yarışın "sunucusu" olur, ekranda bir **oda kodu** görünür.
- **Öğrenciler** `index.html` sayfasına girip oda kodunu ve öğretmenin verdiği **şifreyi** yazar.
- Bağlantı, tarayıcılar arasında doğrudan kurulur (WebRTC, [Trystero](https://github.com/dmotz/trystero) kütüphanesi). Tarayıcıların birbirini bulması için aynı anda birkaç açık Nostr sunucusu kullanılır. Bunlardan biri çalışmasa da diğerleri üzerinden bağlantı kurulur. Hesap ya da API anahtarı gerekmez; eşleşme bilgileri oda koduyla şifrelenir.
- Öğretmen sekmesi kapanırsa yarış durur. Sayfa yenilenirse aynı oda yeniden açılır ve öğrenciler otomatik olarak geri bağlanır. Öğretmen ekranını projeksiyona yansıtabilirsiniz.

## GitHub Pages'te yayınlama
1. GitHub'da yeni bir depo açın (ör. `yazma-yarisi`) ve bu klasördeki tüm dosyaları yükleyin.
2. **Settings → Pages → Build and deployment** bölümünde *Deploy from a branch*, dal olarak `main`, klasör olarak `/ (root)` seçin.
3. Bir dakika içinde site `https://KULLANICI.github.io/yazma-yarisi/` adresinde yayında olur.
   - Öğrenciler: `.../yazma-yarisi/`
   - Öğretmen: `.../yazma-yarisi/ogretmen.html`

## Ders akışı
1. Öğretmen sayfasını açın. Şifreler otomatik üretilir; adları düzenleyip **Kaydet**'e basın.
2. Tahtaya oda kodunu yazın, her öğrenciye kendi şifresini verin.
3. Öğrenciler bağlanınca (yeşil "bağlı") **Yarışı başlat**'a basın: 5 saniyelik geri sayımdan sonra yarış başlar.
4. Yeni tur için **🎲 Rastgele metin** → **Kaydet** → **Yarışı başlat**.

## Kurallar
- Hatalı harf kırmızı görünür, silinip düzeltilmeden ilerlenmez. `â/î/û` yerine `a/i/u` yazmak kabul edilir.
- Yapıştırma kapalıdır. Süreler öğretmenin bilgisayarında ölçülür. Saniyede 25 karakterin üstü kabul edilmez.
- Hız = (doğru karakter / 5) / dakika.
- Yarış başladığında bağlı olan öğrencilerin hepsi bitirince yarış kendiliğinden biter. Öğretmen isterse **Bitir** ile erken kapatabilir.

## Metin ekleme
`texts.js` dosyasındaki listeye istediğiniz kadar paragraf ekleyebilirsiniz (50–100 kelime önerilir). Öğretmen ekranındaki metin kutusuna elle metin de yazılabilir.

## Bilinen sınırlamalar
- Bağlanmak 5–20 saniye sürebilir.
- Bazı okul/kurum ağları WebRTC bağlantılarını veya Nostr sunucularını engelleyebilir. Öğrenci "Odaya ulaşılamadı" görürse aynı Wi-Fi'ye bağlanmayı ya da mobil veriyi deneyin.
- Belirli Nostr sunucularını kullanmak isterseniz iki sayfayı da `?relay=wss://sunucu1,wss://sunucu2` ile açın.
