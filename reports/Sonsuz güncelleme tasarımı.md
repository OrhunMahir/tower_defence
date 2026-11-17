# Hordewall sonsuz güncellemesi: tasarım

Bu belge, araştırmanın ve verdiğin cevapların üstüne kurduğum tasarımı anlatır. Güncelleme uygulandı; aşağıdaki sayılar botlarla ölçülüp ayarlanmış son değerlerdir. İlk taslaktan farkları ve ölçüm sonuçlarını sondaki iki bölümde topladım. Arayüz ve metinler İngilizce kalır; aşağıdaki adların oyundaki karşılığını parantez içinde verdim.

## Verdiğin kararlar

| Konu | Karar |
|---|---|
| Kale düşünce | Koşu biter, yenisi başlar. Zafer ekranı yok; oyun sonsuza kadar sürer |
| Tavansız ilerleme | Sınırsız kuşatma merdiveni. Kalıcı güç yok |
| Çeşitlilik | Sürü mutasyonları, mevsimler ve hava, uyum sağlayan sürü |
| Koşu süresi | Ortalama oyuncu 1–1,5 saat; iyi kararlar koşuyu uzatır |
| Boss'lar | Ayrı sistem yok; mutasyonların bir kısmı boss'lara özel |
| Altın Çağ sonrası | Üç yollu çağ ağacı: bir yol seçilir, diğer ikisi o koşuda kapanır |
| Şöhret | Sınırsız unvanlar ve daha uzun kilit listesi |
| Başlangıç | Yeni sistemler baştan, kademeli olarak devreye girer |

## Takvim: dalga, mevsim, yıl

Üç saat tek bir takvimde birleşiyor.

- **Mevsim** 8 dalgadır ve bir boss'la biter. **Yıl** dört mevsimdir (32 dalga).
- Her mevsimin kendi boss'u var: ilkbaharda Kraliçe, yazda Behemoth, sonbaharda Kuluçka Ana, kışta Gök Tiranı. Boss'lar her 8. dalgada gelir: 8, 16, 24, 32, 40...
- Gök Tiranı 30. dalgadan 32. dalgaya kayıyor. İlk yılı bitirmek eski "zafer"in yerini alan kilometre taşı: bir kutlama ve şöhret primi gelir, koşu durmaz.
- Ekranda her zaman "Yıl 2 · Yaz · Dalga 43" biçiminde görürsün.

## Mevsimler

Her mevsim sekiz dalga boyunca iki tarafı da etkiler.

| Mevsim | Sana yarayan | Sürüye yarayan |
|---|---|---|
| İlkbahar (Spring) | Hasat %25 fazla; dalga sonu ücretsiz onarım %15 fazla | Sürü %8 kalabalık |
| Yaz (Summer) | Savunucuların menzili %8 fazla | Canavarlar %8 hızlı |
| Sonbahar (Autumn) | Dalga altını %20 fazla; şans +15 | Canavarlar %10 dayanıklı |
| Kış (Winter) | Canavarlar %12 yavaş | Hasat yarıya iner |

## Hava

Her dalganın bir havası var. Mevsime göre zar atılır; sonraki iki dalganın havasını önceden görürsün. İlk üç dalga her zaman açıktır.

| Hava | Etki | Hangi mevsimde |
|---|---|---|
| Açık (Clear) | Etki yok | Hepsi |
| Yağmur (Rain) | Yanma hasarı %40 az; şimşek bir canavara daha sıçrar; canavarlar %8 yavaş | İlkbahar, sonbahar, az da olsa yaz |
| Sis (Fog) | Bütün menziller %20 kısa (canavarlarınki de); ganimet şansı +25 | İlkbahar, sonbahar, kış |
| Rüzgâr (Gale) | Uçan canavarlar %30 yavaş; zehir bulutları yarı sürede dağılır | Hepsi |
| Gök gürültüsü (Thunderstorm) | Beş saniyede bir yıldırım rastgele bir canavarı vurur; her yıldırım %20 ihtimalle bir savunucuyu 2,5 saniye sersemletir | Yaz, az da olsa ilkbahar |
| Sıcak dalgası (Heatwave) | Yanma hasarı %50 fazla; savunucular %8 yavaş saldırır | Yaz |
| Kar (Snow) | Canavarlar %15 yavaş; buz yavaşlatması %25 güçlü; menzil %8 kısa | Kış |
| Tipi (Blizzard) | Canavarlar %25 yavaş; bütün menziller %15 kısa | Kış |

Hava sahnede de görünür: yağmur ve kar tanecikleri, sis, şimşek çakması, ışığın rengi. Mevsim de görünür: sonbaharda toprak ve yapraklar sararır, kışın yer karla kaplanır. Sis ve tipi ne kadar yoğun olursa olsun savaş alanı okunaklı kalır.

## Zorluk eğrisi ve ekonomi

- **İlk 32 dalganın can ve hasar eğrisi aynı kalır.** 32. dalgadan sonra can da hasar da dalga başına %12 artar.
- **İlk yılda zor dalgalar biraz küçük gelir.** Zor dalga standart bütçenin 1,75 katı yerine 1,65 katını, ölümcül dalga 2,7 katı yerine 2,5 katını getirir; ödülleri aynıdır. 33. dalgadan itibaren tam boydadırlar. Nedeni ve ölçümü belgenin sonunda.
- **Öfke kuralı:** bir dalga iki dakikayı geçerse canavarların hasarı saniyede %4 artar. Savunması çok güçlü bir kale bile bir dalgayı sonsuza kadar oyalayamaz.
- **Yüzdelik etkiler derinlikte sönümlenir:** canın yüzdesi üzerinden vuran etkiler (zehir, keskin surlar, yıldız yağmuru gibi) ve gökten inen kale yetenekleri, canavar canı büyüdükçe aynı oranda zayıflar. Yoksa tek bir eşya bütün eğriyi geçersiz kılıyordu.
- **Boss'lar artık geride kalmaz.** Bugün boss canı sürüden yavaş büyüyor; 32'den sonra aynı hızla büyür.
- **Canavar sayısı sınırlı kalır** (dalga başına 110). Fazlası daha dayanıklı elitlere döner; dalga süresi uzamaz.
- **Hasat artık katlanarak büyümez.** Dalga başına büyüme ilk yıl %5, ikinci yıl %2,5, üçüncü yıl %1,25 olur.
- **Hedef:** ilk yılı geçen botların çoğu 35–57. dalga arasında düşer; hiçbir bot sonsuza kadar yaşamaz. Ölçüm sonuçları belgenin sonunda.

## Sürü mutasyonları

Her boss'tan sonra sürü kalıcı bir özellik kazanır. Üç seçenek gelir; birini seçmek zorundasın, atlamak ya da yeniden çekmek yok. Her seçenek bir mutasyon ve bir ödülden oluşur. Seçeneklerin ikisi öldürdüğün boss'un mirasından, biri başka bir boss'unkinden gelir. Her mutasyon üç seviyeye kadar birikir (aşağıdaki sayılar seviye başınadır).

| Miras | Mutasyon | Etki |
|---|---|---|
| Kraliçe | Kabaran saflar (Swollen ranks) | Sürü %10 kalabalık |
| Kraliçe | Ölüm çığlığı (Death cry) | Ölen canavar çevresindekileri 1,5 saniye hızlandırır |
| Kraliçe | Çılgınlık (Frenzy) | Canavarlar %7 hızlı |
| Kraliçe | Şampiyonlar (Champions) | Her dalgaya bir şampiyon eklenir |
| Kraliçe | Muhafız alayı (Royal guard) | Boss'lar iki seçkin brute ile gelir |
| Kraliçe | Kadim güç (Ancient power) | Boss güçleri %20 sık kullanılır, boss canı %15 fazla |
| Behemoth | Kalın deri (Thick hides) | Her canavara +3 zırh |
| Behemoth | Kabuk (Shells) | Canavarların üçte biri ilk doğrudan vuruşu yok sayar (üçüncü seviyede hepsi) |
| Behemoth | Kuşatma ustalığı (Siegecraft) | Surlara verilen hasar %15 fazla |
| Behemoth | Vahşet (Savagery) | Canavar hasarı %10 fazla |
| Behemoth | Zırhlı öncüler (Plated vanguard) | Brute, koçbaşı ve shellback canı %25 fazla |
| Behemoth | Kan öfkesi (Blood rage) | Canı yarının altına inen boss %25 hızlanır |
| Kuluçka Ana | Yavrular (Spawnlings) | Canavarların %10'u ölünce iki yavruya bölünür |
| Kuluçka Ana | Yenilenme (Regrowth) | Canavarlar saniyede canlarının %0,5'ini yeniler |
| Kuluçka Ana | Patlayıcı (Volatile) | Sur dibinde ölen canavar patlayıp sura hasar verir |
| Kuluçka Ana | Tünelciler (Tunnelers) | Koşucu ve brute'ların %8'i surların altından geçer |
| Kuluçka Ana | İkiz efendiler (Twin lords) | Boss dalgasına ikinci, farklı bir boss katılır (%50, %75, %100 canla) |
| Kuluçka Ana | İkinci nefes (Second wind) | Boss ilk ölümünde %20 canla yeniden kalkar |
| Gök Tiranı | Kanatlı yavrular (Winged brood) | Koşucuların %8'i uçan canavar olarak gelir |
| Gök Tiranı | Gece baskını (Night raids) | Her 4., sonra 3., sonra 2. dalga gece olur (menzil %20 kısa) |
| Gök Tiranı | Dehşet halesi (Dread aura) | Boss'a yakın savunucular %12 yavaş saldırır |
| Gök Tiranı | Yağmacılar (Plunderers) | Kaleye inen her vuruş altın çalar |
| Gök Tiranı | Büyü kalkanı (Hexward) | Yavaşlatma ve lanetler %20 zayıflar |
| Gök Tiranı | Zehir (Venom) | Menzilli canavarın vurduğu surdaki savunucu 3 saniye %10 yavaşlar |

**Ödüller:** altın, bedava kale seviyesi, epik ya da efsanevi bir eşya, bir stat artışı, bir savunucunun terfisi ya da fazladan bir kalıntı seçimi. Sert mutasyonların ödülü iki kat değerlidir. Aynı seçimdeki üç seçenek her zaman farklı türde ödül taşır.

## Sürünün uyumu

- Hasar altı okula ayrılır; okul, hasarı veren savunucunun ailesidir (taretler mühendislere yazılır). Kale yetenekleri sayılmaz.
- İkinci boss'tan başlayarak her boss'tan sonra sürü, o mevsim kendisine en çok hasar veren okula **%8 direnç** kazanır (en çok %40). Diğer okullara direnci %4 azalır ve eksiye düşebilir: unutulan bir okul %24'e kadar **fazla** hasar verir.
- En çok hasar veren okulun payı %30'un altındaysa sürü bir örüntü bulamaz ve yalnızca unutma işler. Dengeli ordu bu yüzden neredeyse hiç direnç görmez.
- Yeni **Horde** sekmesinde bu mevsimin hasar paylarını ve mevcut dirençleri görürsün; sürünün neye uyum sağlayacağı sürpriz olmaz.

## Çağ ağacı

İlk dört çağ aynı: Ahşap, Taş, Demir, Altın. 32. dalgadaki boss'tan sonra beşinci çağa geçerken üç yoldan birini seçersin. Yol o koşu için kesindir; sonraki iki çağ o yolun çağlarıdır (40. ve 48. dalga boss'larından sonra). Çağ atlama kuralı değişmez: boss, kale seviyesi ve altın.

| | Gereken kale seviyesi | Altın |
|---|---|---|
| 5. çağ | 24 | 4.000 |
| 6. çağ | 28 | 7.000 |
| 7. çağ | 32 | 12.000 |

Her yol çağı şunları getirir: kendi sur ve kale görünümü, kalıcı bir çağ gücü, iki yeni sınıf, bir doktrin seçimi, kale ve bina seviye sınırlarında artış. Yeni çağa girince iki yeni sınıftan birini hemen saflarına katabilirsin. Her yol, altı ailenin her birine bir sınıf ekler.

### Görkem yolu (Path of Splendour): Obsidyen, Kristal, Yıldız

Kritik vuruş ve ham güç.

| Çağ | Çağ gücü | Yeni sınıflar |
|---|---|---|
| Obsidyen (Obsidian) | Keskin surlar: sura vuran canavar canının %8'ini kaybeder; sur canı %20 fazla | **Lavamancer** (simya): yerde yanan lav havuzu bırakır. **Glaivemaster** (muhafız): canı %15'in altındaki canavarı tek vuruşta bitirir |
| Kristal (Crystal) | Rezonans: kritik şansı +%8; kritik vuruş yandaki bir canavara yarı hasarla sıçrar | **Prismancer** (büyü): aynı hedefe vurdukça güçlenen ışın. **Shardbow** (nişancı): oku üç kıymığa bölünür |
| Yıldız (Star) | Yıldız yağmuru: sekiz saniyede bir en güçlü canavara yıldız düşer | **Stargazer** (inanç): işaretlediği canavara inen vuruşlar kritik olur. **Starforger** (mühendis): en kalabalık yere göktaşı indirir |

### Sanayi yolu (Path of Industry): Çelik, Barut, Buhar

Taretler, toplar ve sağlam surlar.

| Çağ | Çağ gücü | Yeni sınıflar |
|---|---|---|
| Çelik (Steel) | Zırh levhası: sur ve kale %15 az hasar alır; onarım yarı fiyatına | **Repeater** (nişancı): üçlü atış yapar. **Ironclad** (muhafız): vurduğu canavarı surdan geri iter |
| Barut (Powder) | Sur topları: dört kulenin her birine kendiliğinden ateş eden bir top yerleşir | **Rocketeer** (simya): uzun menzilli, uçanları da vuran roket. **Artillerist** (mühendis): bir sıra canavarı delip geçen gülle |
| Buhar (Steam) | Makineler: taretler %30 hızlı ateş eder ve birer seviye kazanır; dükkân her dalga bir kez bedava yenilenir | **Galvanist** (büyü): vurduklarını sersemleten zincir şimşek. **Wallwright** (inanç): suru onarır, yıkılmış suru yeniden kaldırır |

### Efsane yolu (Path of Legend): Rün, Ejder, Göksel

Koruma büyüleri, ateş ve mucizeler.

| Çağ | Çağ gücü | Yeni sınıflar |
|---|---|---|
| Rün (Rune) | Koruma rünleri: surlar saniyede canlarının %1'ini yeniler; her sur parçası dalgada bir kez yıkılmayı reddeder | **Runeblade** (muhafız): vurduğu canavar herkesten %20 fazla hasar alır. **Runesmith** (mühendis): yanındaki savunucuların hasarını artırır |
| Ejder (Dragonfire) | Ejder yuvası: kalenin üstünde dönen ejder on saniyede bir en kalabalık yeri yakar | **Drake keeper** (simya): koni biçiminde alev püskürtür. **Lancer** (nişancı): ağır mızrağı canavarı yere çiviler |
| Göksel (Celestial) | Lütuf: kale dalga boyunca kendini onarır ve dalgada bir kez öldürücü darbeden %30 canla çıkar | **Seraph** (inanç): kaleyi iyileştirirken yakındaki canavarları çarpar. **Skycaller** (büyü): gecikmeli, geniş bir ışık sütunu indirir |

Oyundaki çağ adı "Dragonfire Age" olacak; "Dragon Age" başka bir oyunun adı olduğu için kullanmıyorum.

Her yeni sınıfın, diğerleri gibi 6. seviyede seçilen iki uzmanlığı olur.

### Yükselişler

Yolun üçüncü çağından sonra her boss bir **yükseliş** (Ascension) açar; yine kale seviyesi ve altınla satın alınır ve sonsuza kadar sürer. Her yükseliş hasarı ve sur canını %10 artırır, seviye sınırlarını açar ve efsanevi kalitede iki stat seçimi verir.

Yolun üçüncü çağı ayrıca altıncı bir nadirlik açar: **Exalted** (mitiğin üstü).

## Yeni asker alma kuralları

Bugün surlar dolunca yeni savunucu gelmiyor, yalnızca terfi çıkıyor. Yeni sınıfların kullanılabilmesi için:

- **Değişim:** surlar doluyken gelen asker teklifi, en zayıf savunucunun yerini almayı önerir. Yeni gelen, gidenin seviyesinin %80'ini devralır. Kimin gideceği kartta yazar.
- **Toplanma (Muster):** bir yol çağına girince o çağın iki sınıfından biri hemen teklif edilir.

## Kuşatma merdiveni

- Seviye 10'da durmaz. 11'den sonra her seviye canavar canını %6, hasarını %3 artırır; her iki seviyede bir sürü koşuya hazır bir mutasyonla başlar.
- **Kilit:** açık olan en yüksek seviyede 32. dalgadaki boss'u yenmek bir sonrakini açar. Aynı koşuda yendiğin her fazladan boss bir seviye daha açar (40. dalga iki, 48. dalga üç seviye).
- Şöhret çarpanı seviyeyle birlikte sınırsız artar.

## Şöhret, unvanlar ve rekorlar

- **Şöhret:** temizlenen dalga + boss dalgası başına 8 + çağ başına 5 + biten yıl başına 20, hepsi kuşatma çarpanıyla çarpılır. Duraklatma menüsünden bırakılan koşu da şöhretini alır.
- **Unvanlar:** toplam şöhret güç vermeyen sınırsız bir rütbeye dönüşür. İlk on iki rütbenin adı var (Watchman'dan Emperor'a); sonrası "Emperor II, III..." diye sürer.
- **Rekorlar:** her kuşatma seviyesi ve her lord için en derin dalga.

## Yeni açılabilir içerik

| Tür | Yeni | Örnekler |
|---|---|---|
| Lordlar | 5 | Seer (bir mutasyon seçeneği fazla, hava üç dalga ileri görünür), Slayer (boss'lara %40 fazla hasar), Druid (mevsim nimetleri iki kat), Tactician (surdaki her aile +%4 hasar), Conqueror (zor dalgalar daha çok öder) |
| Yetenekler | 3 | Signal fire (kısa süre menzil artışı), Caltrops (yavaşlatan ve yaralayan alan), Last stand (kale birkaç saniye hasar almaz) |
| Kalıntılar | 6 | Havayı, hasadı, uyumu ve geceyi etkileyen boss kalıntıları |

## Arayüz

- Üst çubukta yıl, mevsim, bugünün havası ve sonraki iki dalganın tahmini.
- Mutasyon seçimi, yol seçimi ve toplanma için yeni seçim pencereleri.
- Yeni Horde sekmesinde takvim, hava tahmini, sürünün mutasyonları ve uyum çubukları.
- Dalga kartlarında günün havası, ikiz boss, muhafızlar ve gece baskını.
- Zafer ekranı kalkar; koşu sonu ekranı derinliği, unvan ilerlemesini ve açılan kuşatma seviyelerini gösterir.
- Ana menüde kuşatma seviyesi için sınırsız bir seçici.

### Görünüm (17 Kasım 2026)

İstek şuydu: emoji simgeler ve yazılar yapay zekâ işi gibi duruyor, daha insan yapımı görünsün; çimen dokuları da düzelsin.

- **Simgeler.** Oyundaki 156 farklı emoji ve işaret kalktı. Yerlerine `client/icons.js` içinde çizgi çizgi çizdiğim 219 çizim geldi: mürekkep çizgili, düz boyalı, kâğıttan kesilmiş gibi. Eşyaların, lordların, yeteneklerin, mutasyonların, binaların, doktrinlerin, olayların, başarımların, mevsimlerin ve havanın çizimleri var; beş taretin her biri ayrı çizildi. Aynı şeyi anlatan birkaç yerde aynı çizim kullanılıyor. Çizgiler bilerek biraz titrek, boya çizgiye tam oturmuyor.
- **Yazı.** Cinzel ve Inter gitti. Başlıklarda Grenze Gotisch, metinde Alegreya Sans var. Büyük harfli küçük etiketler ("RARE ITEM", "DAMAGE") küçük italik yazıya döndü. Her yerdeki "·" ayraçları ve iki nokta üst üsteli kalıplar düz cümle oldu.
- **Panolar.** Bulanık cam paneller, parlayan çerçeveler ve geçişli düğmeler yerine düz boyalı panolar, koyu kalem çizgileri, sert gölgeler ve kâğıt etiketler var. Köşelerin hiçbiri birbirinin aynısı değil.
- **Zemin.** Çimen artık boyanmış bir doku: yeşil lekeler, tek tek çizilmiş ot öbekleri, birkaç çiçek. Kalenin altında ve yolda kenarı düzensiz toprak yamaları, yolda tekerlek izleri var. Tarlalarda üç boyutlu ot öbekleri duruyor, ilkbaharda ve yazda çiçek açıyor. Mevsim rengi ve kar bunlara da işliyor.
- `scripts/icons.html` bütün çizimleri oyundaki boyutlarında gösterir.

## Kendi başıma verdiğim kararlar

Bunları sana sormadım; beğenmediğini değiştiririm.

1. Mevsimi 8 dalga yapıp boss'lara bağladım. Böylece dalga, bölüm ve devir tek takvim oldu.
2. Gök Tiranı'nı 30'dan 32'ye aldım ki dört mevsim eşit olsun.
3. Mutasyon seçiminde atlama ve yeniden çekme yok.
4. Surlar doluyken değişim teklifi ve çağ başında toplanma ekledim; yoksa yeni sınıflar hiç kullanılamazdı.
5. Altıncı nadirliği (Exalted) ekledim.
6. Eski kayıtlı koşular yeni sürümde açılmaz; profil (şöhret, kilitler, rekorlar) korunur.
7. Duraklatma menüsündeki "Give up the castle" koşuyu olduğu yerde bitirir; şöhret, rekor ve merdiven sayılır.
8. Tek kişilik oyunda koşu sonu ekranı sen karar verene kadar kalır. Eskiden 45 saniye sonra (3× hızda 15 saniye) kendiliğinden yeni koşu başlıyordu.

## İlk taslaktan farklar

Uygulayıp botlarla ölçtükten sonra şunları değiştirdim:

| Konu | İlk taslak | Son hali | Neden |
|---|---|---|---|
| 32. dalgadan sonra büyüme | can %10, hasar %6 | can %12, hasar %12 | Savunma hasardan hızlı büyüyordu; iyi giden koşular hiç bitmiyordu |
| Uzayan dalga | kural yok | iki dakikadan sonra öfke | Bir bot 220 dakika savaşıp 100. dalgayı geçti |
| Yüzdelik etkiler | sabit | derinlikte sönümlenir | Can yüzdesiyle vuran etkiler eğriyi yok sayıyordu |
| Mevsim yükleri | %12, %10, %12 | %8, %8, %10 | İlk yıl eskisinden belirgin zorlaşmıştı |
| Uyum | %12, en çok %48 | %8, en çok %40 | Tek aileye dayanan ordular çok erken çöküyordu |
| Kabuk mutasyonu | her canavar | seviye başına üçte biri | Sürü dalgalarında gereken vuruş sayısını ikiye katlıyordu |
| Muhafız alayı | iki şampiyon | iki seçkin brute | Şampiyon muhafızlar boss'tan tehlikeliydi |
| 6. ve 7. çağ | seviye 29 / 8.000 ve 34 / 15.000 | 28 / 7.000 ve 32 / 12.000 | Temkinli oynayan botlar yolun üçüncü çağını hiç göremiyordu |
| Sis ve tipi görüntüsü | yoğun | seyreltildi | Kale görünmez oluyordu |
| Koçbaşı fiyatı | 9 puan | 12 puan | Puan başına hem en dayanıklı canavar hem en iyi sur kırıcıydı; zor koçbaşı dalgalarının üçte biri koşuyu bitiriyordu |
| İlk yılda zor dalga | bütçenin 1,75 katı (ölümcül 2,7) | 1,65 katı (ölümcül 2,5); ikinci yıldan itibaren eskisi gibi | Orta güçte bir kale için zor dalga tuzaktı |

## Ölçüm sonuçları

Botlar ortalamanın altında oynar: hedef almaz, savunucu yerleştirmez, dalgayı ordusuna göre seçmez. Sayılar 17 Kasım 2026 tarihli ve ilk yıl yumuşatmasından sonraki kurallarla ölçüldü.

### Koşular ne kadar derine iniyor

Her satır, kale düşene kadar oynanan 48 bot koşusu (hiç harcamayan bot için 16).

| Bot | Düştüğü dalga (ortanca) | İlk yılı geçen | Savaş süresi (ilk yılı geçenler, ortanca) |
|---|---|---|---|
| Hiç harcamayan | 5 | 0 / 16 | |
| Rahat kuşatma (0), kolay dalgalar | 61 | 47 / 48 | 34 dk |
| Normal kuşatma (1), kolay dalgalar | 41 | 31 / 48 | 32 dk |
| Normal, her çift dalgada zor | 36 | 30 / 48 | 28 dk |
| Normal, hep zor dalgalar | 59 | 45 / 48 | 42 dk |
| Kuşatma 3, kolay | 22 | 18 / 48 | 33 dk |
| Kuşatma 3, hep zor | 38 | 27 / 48 | 41 dk |
| Kuşatma 5, hep zor | 17 | 13 / 48 | 31 dk |
| Kuşatma 6, kolay | 14 | 4 / 48 | 36 dk |
| Kuşatma 10, kolay | 8 | 0 / 48 | |

- **Hiçbir bot sonsuza kadar yaşamıyor.** En derin koşu 82. dalgada bitti.
- **Süre hedefi tutuyor.** Normal kuşatmada ilk yılı geçen koşular 28–42 dakika savaşıyor. Hazırlık süresiyle bu yaklaşık 1–1,5 saat eder.
- **Kararlar koşuyu uzatıyor.** Hep zor dalga seçen bot (iki kat altın ve tecrübe) yol çağlarına 34., 42. ve 51. dalgada ulaşıyor; 48 koşunun 31'i yolun üçüncü çağını görüyor. Hep kolay seçen bot aynı çağlara 38., 47. ve 57. dalgada ulaşıyor ve üçüncü çağı 48 koşunun yalnızca 4'ü görüyor.
- **Merdiven kademeli.** Hep zor seçen bot ilk yılı kuşatma 3'te 48 koşunun 27'sinde, kuşatma 5'te 13'ünde geçiyor. Kolay seçen bot kuşatma 3'te 18'inde, kuşatma 6'da 4'ünde geçiyor; kuşatma 10'da hiç geçemiyor.
- **Bu tablo eskiden 16 koşuyla çıkarılıyordu; azmış.** Ortancalar oynaktı: "normal, her çift dalgada zor" satırı 16 koşuda 22 görünüyordu, aynı kurallarla 48 koşuda 36 çıkıyor. Satırları bu yüzden 48 koşuya çıkardım.

### İlk yılın zor dalgaları

İstek şuydu: ilk yılın zor dalgaları yumuşasın, ama oyun aşırı kolaylaşmasın.

**Önce bir düzeltme.** Bu belgenin önceki sürümünde "her çift dalgada zor seçen botların 16'da 10'u 30. dalgadan önce düşüyor, eskiden 16'da 6" yazıyordu. Bu fark şans payıydı. 48'er koşuda eski sürüm 30. dalgadan önce 23, yeni sürüm 22 koşu kaybediyor. Sonsuz güncellemesi ilk yılı zorlaştırmamış; zor dalgalar ondan önce de bu kadar riskliydi. Değişen, düşüşlerin yeri: eskiden 10–14. dalgalarda, şimdi 18–22. dalgalarda toplanıyor.

**Ne buldum.** Normal kuşatmada, her bot türüyle 960 koşu:

- Arada bir zor dalga seçmek en tehlikeli oynayıştı. Bu botların %49'u ilk yılda düşüyordu; hiç zor seçmeyenlerde oran %33, hep zor seçenlerde %23'tü. Hep zor seçen baştan beri iki kat altın ve tecrübe topladığı için güçleniyor. Arada bir seçenin kalesi orta güçte kalıyor ve zor dalga onu tek seferde bitiriyor.
- Düşen kalelerin hepsi o dalgaya tam canla girmişti (468 düşüşün 468'i). Ağır yaralanıp ayakta kalınan dalga az: zor dalga çoğunlukla ya temiz geçiyor ya koşuyu bitiriyor.
- Koçbaşı açık ara en ölümcül canavardı. Zor koçbaşı dalgalarının %31'i koşuyu bitiriyordu; ikinci sıradaki tünelci dalgalarında oran %16. Koçbaşı 9 puana 420 can, zırh ve vuruş başına 150 sur hasarı getiriyordu; brute 4 puana 150 can ve 40 sur hasarı. Puan başına hem en dayanıklı canavar hem en iyi sur kırıcıydı.
- Suç yeni kurallarda değil. Mutasyonları, uyumu, havayı ve mevsimi tek tek kapattığımda koşuyu bitiren zor dalga oranı %6,0'dan ancak %5,2–5,9'a iniyor. Sorun zor dalganın boyutundaydı.

**Aynı kaleler, aynı zor dalgalar, farklı kurallar.** Botun zor dalgayı seçtiği 363 kaleyi dalgadan hemen önce kaydettim ve her birini dörder kez zor dalgaya soktum. Kale ve zarlar aynı olduğu için fark şanstan değil kuraldan geliyor.

| Kural | Koşuyu bitiren zor dalga |
|---|---|
| Eski kural (zor = bütçenin 1,75 katı) | %6,0 |
| Koçbaşı 12 puan | %5,1 |
| Koçbaşı 12 puan, ilk yılda zor = 1,65 kat (uygulanan) | %3,5 |
| Koçbaşı 12 puan, ilk yılda zor = 1,6 kat | %2,3 |
| Koçbaşı 12 puan, ilk yılda zor = 1,5 kat | %1,3 |

**Uygulanan kural.**

1. Koçbaşı artık 12 puan tutuyor (9'du). Koçbaşı dalgalarına dörtte bir daha az koçbaşı geliyor. Bu her yıl ve standart dalgalar için de geçerli.
2. İlk yılda zor dalga standart bütçenin 1,65 katını getiriyor (1,75'ti), ölümcül dalga 2,5 katını (2,7'ydi). Ödüller aynı. 33. dalgadan itibaren eski boyutlarına dönüyorlar.

**Sonuç.** Her bot türüyle 960 koşu; ilk yılda düşen koşuların oranı:

| Bot | Önce | Sonra |
|---|---|---|
| Hiç zor seçmeyen | %33 | %26 |
| Her çift dalgada zor seçen | %49 | %38 |
| Hep zor seçen | %23 | %12 |

- Arada bir zor seçen botta zor dalga başına ölüm %5,0'dan %3,6'ya indi. Zor koçbaşı dalgalarında %31'den %15'e indi; koçbaşı artık aykırı değil, tünelcilerle aynı seviyede.
- Zor dalga hâlâ kumar. Arada bir zor seçen bot, hiç seçmeyenden belirgin biçimde sık düşüyor (%38'e karşı %26).
- Ölümcül dalgalar ölümcül kaldı. Aynı kalelerde koşuyu bitirme oranları %36'dan %27'ye indi.
- İlk yıldan sonrası değişmedi sayılır. 48'er koşuda kolay seçen botun ortalama derinliği 36,4'ten 37,7'ye, karışık seçenin 33,6'dan 33,3'e geldi. Hep zor seçen bot daha derine iniyor (45,5'ten 53,6'ya), çünkü ilk yılı geçenlerin sayısı arttı (48'de 38'den 45'e).

**Neden daha fazla yumuşatmadım.** 1,6 kat, arada bir zor seçen botun kaybını %33'e indiriyor ve aynı kalelerde zor dalganın ölümcüllüğünü üçte bire düşürüyor (%6,0'dan %2,3'e). "Aşırı kolay olmasın" dediğin için orta yolda, 1,65'te durdum. Daha yumuşak ya da daha sert istersen değişecek tek sayı `server/data.js` içindeki `pts1`.

**Bilerek dokunmadıklarım.**

- Hep zor seçmek hâlâ en güvenli oynayış. Yumuşatmadan önce de böyleydi; çift ödülün baştan birikmesinden geliyor.
- Zor dalga çoğunlukla ya temiz geçiyor ya koşuyu bitiriyor. Dalga kartı, kalenin o dalgayı kaldırıp kaldıramayacağını söylemiyor.

Ölçmediklerim: bunların hepsi bot tahmini. Oyunu bir insan oynamadı; zorluk hissi, koşu süresi ve kuşatma 6 üstünün gerçekten oynanabilir olup olmadığı senin oynayışınla belli olacak.

## Uygulama sırası

1. Kurallar: takvim, eğri, mevsim ve hava, mutasyonlar, uyum.
2. Çağ ağacı, on sekiz sınıf, yükselişler.
3. Kuşatma merdiveni, şöhret, unvanlar, yeni kilitler.
4. Testler, botlar ve denge ölçümü.
5. Arayüz, modeller ve hava görselleri.
6. Tarayıcıda doğrulama, README ve notlar.
