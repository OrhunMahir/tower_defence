# Sonsuz oyunu sayılar değil, değişen kurallar ayakta tutar

Sonu olmayan oyunların hepsi aynı üç şeyi yapıyor. Birincisi, zorluğu tek bir sayıyla değil üç ayrı saatle büyütüyorlar: her dalga, her bölüm (boss'a kadar) ve her devir (bütün boss'lar bir kez yenilince). İkincisi, her devirde yalnızca can ve hasarı artırmıyor, oyunun bir kuralını da değiştiriyorlar. Üçüncüsü, düşmanı oyuncudan hızlı büyütüyorlar ki her koşu eninde sonunda bitsin; büyüme durduğu anda oyun "çözülüyor" ve ritüele dönüşüyor. Koşular arası tavansız ilerleme için dört model var: sınırsız zorluk merdiveni, sınırsız ama küçük kalıcı güç, yalnızca rekor kırınca gelen deneyim ve her koşunun ürettiği miras. Kalıcı güç tek başına oyunu bozmuyor, çünkü düşman katlanarak büyüdüğünde gücü ikiye katlamak yalnızca birkaç dalga daha kazandırıyor.

Hordewall'un bugünkü sonsuz modu bu kuralların hiçbirine uymuyor. Botlarla ölçtüğümde koşular ya 37–44. dalgada bitti ya da hiç bitmedi: bir bot 120. dalgada kalesi tam canla duruyordu ve 26. dalgadan sonra oyuna yeni hiçbir şey girmiyordu.

**Yöntem notu.** Kuralları mümkün olan yerde oyunların kendi wiki'lerinden ya da birincil kaynaktan okudum: Brotato, Vampire Survivors, Slay the Spire, Risk of Rain 2, RimWorld, Thronefall, Plants vs. Zombies ve Halo wiki'leri, Mindustry'nin kaynak kodu, Valve'ın Left 4 Dead sunumu, How Many Dudes?'un Steam duyuruları ve tartışmaları, Anthony Pecorella'nın idle oyun matematiği yazıları. Fandom'daki wiki'ler otomatik okumayı reddetti; bu yüzden Bloons TD 6, Nuclear Throne ve The Tower için topluluk rehberlerine, Diablo 3, Mythic+, GemCraft, Rogue Legacy 2, Last Epoch, Balatro ve Warframe için arama özetlerine dayandım. Bu ikinci gruptaki sayılar yaklaşık kabul edilmeli; kaynakların çeliştiği yerleri metinde belirttim. Killing Floor 2'nin sonsuz mod kurallarını doğrulayamadığım için rapora almadım.

## Bugünkü sonsuz mod ya 40. dalgada bitiyor ya hiç bitmiyor

Mevcut kurallarla altı bot koşusunu 120. dalgaya kadar sürdüm (kuşatma 1, üç tohum, kolay ve zor dalga seçimi):

| Seçim | Tohum 11 | Tohum 22 | Tohum 33 |
|---|---|---|---|
| Kolay dalgalar | 37. dalgada düştü | 18. dalgada düştü | 89. dalgada düştü |
| Zor dalgalar | 39. dalgada düştü | 44. dalgada düştü | 120. dalgada hâlâ ayakta |

Ayakta kalan botun kalesi 120. dalgada 13.900/13.900 candaydı; yani tehdit altında bile değildi. Nedenleri kodda görülüyor:

- **Düşman büyümesi yavaşlıyor.** Can çarpanı bir polinom. Dalga başına artış 30. dalgada %11, 60. dalgada %6, 100. dalgada %4.
- **Oyuncu büyümesi yavaşlamıyor.** Hayatta kalan botun toplam hasarı 30. dalgadan 120. dalgaya 140 kat arttı; düşman canı aynı aralıkta 150 kat arttı. Canavar sayısı zaten sınırlı olduğu için bu denge oyuncunun lehine kalıyor.
- **Hasat katlanarak büyüyor.** Her dalgada %5 artan hasat 30. dalgada 81 altınken 120. dalgada 2.904 altın oldu.
- **Yeni hiçbir şey gelmiyor.** Son canavar 26. dalgada açılıyor. 30'dan sonra aynı dört boss on dalgada bir, hiçbir yeni güç almadan geri geliyor.

İyi tarafı: dalga süresi sabit kalıyor (30–40 saniye). Canavar sayısını sınırlayıp fazlasını elite çevirme kuralı işini yapıyor.

## Sonsuz oyunlar üç ayrı saatle çalışıyor

İncelediğim oyunların çoğunda zorluk iç içe üç döngüyle ilerliyor. Küçük saat her birkaç dakikada bir, orta saat bir boss'la, büyük saat bütün içerik bir kez görüldüğünde dönüyor. Her saat başka bir şeyi değiştiriyor.

| Oyun | Küçük saat | Orta saat | Büyük saat | Büyük saatte değişen |
|---|---|---|---|---|
| Halo 3: ODST Firefight | dalga | tur (5 dalga) | set (3 tur) | Kalıcı bir "kafatası" kuralı eklenir |
| Slay the Spire (Endless) | kat | perde | döngü (3 perde) | Düşman canı ve hasarı artar, sıradaki kural bozucu "blight" gelir |
| Nuclear Throne | bölüm | alan | döngü | Yeni düşmanlar karışır, ara alanlara döngüye özel boss'lar gelir |
| Risk of Rain 2 | saniye | sahne | döngü (5 sahne) | Sahne başına %15 sıçrama, döngüye özel sahne çeşitleri |
| Brotato (Endless) | dalga | 10 dalga (iki boss birden) | yok | 10 dalgada bir fazladan elit |
| Vampire Survivors (Endless) | dakika | yok | döngü (bölümün süresi) | Can, sayı ve hasar artar, tüccar geri gelir |
| The Tower | dalga | 10 dalga (boss) | kademe | 14. kademeden sonra her kademenin sabit savaş koşulu |

Halo bunun en temiz örneği: beş dalga bir tur, üç tur bir set. Tur içinde geçici kurallar sırayla açılıyor ve set bitince sıfırlanıyor; her yeni set ise kalıcı bir kural ekliyor (4. setten sonra düşmanlar iki kat can ve kalkan). Sonuç düz bir rampa değil, her seferinde biraz daha yukarıdan başlayan bir testere dişi ([Halopedia](https://www.halopedia.org/Firefight_(Halo_3:_ODST))).

## Zorluk sayıyla da kuralla da büyüyor

Sayısal tarafta ortak nokta şu: düşman, oyuncunun yetişemeyeceği bir hızla büyüyor.

| Oyun | Kural | Sonuç |
|---|---|---|
| Brotato | 20. dalgadan sonra "endless factor": dalga sayısının üçgensel toplamı / 100 × çarpan; çarpan 36. dalgadan itibaren büyür. Can ×(1 + 2,25 F), hasar ×(1 + F) | Can 30. dalgada ×3,5, 40'ta ×15, 50'de ×53, 100'de ×1.094 |
| Vampire Survivors | Her döngüde taban canın +%100'ü, sayı ve sıklık +%50, hasar +%25; oyuncunun hasar tavanı 1 düşer | Doğrusal ama dört koldan |
| Slay the Spire | Her döngüde düşman hasarı +%100, +%175, +%250, sonra döngü başına +%75; can döngü başına +%50 | Üç döngüde hasar 3,5 kat |
| Nuclear Throne | Can ×(1 + döngü/20); boss'larda ayrıca ×(1 + döngü/3) | Rekor: 30. döngü |
| Risk of Rain 2 | Zorluk katsayısı = (oyuncu + dakika × zaman çarpanı) × 1,15^sahne; her düşman seviyesi +%30 can, +%20 hasar | Sahne sayısıyla üstel |
| Diablo 3 Greater Rift | Seviye başına can ×1,17 | Her 4,5 seviyede iki katı |
| WoW Mythic+ | Seviye başına +%7, 11'den sonra +%10, 12'den sonra +%12 | Üstel, üst sınır yok |
| Bloons TD 6 | Büyük balonların canı tur başına +%2, sonra +%5, +%15, +%35; 300. turdan sonra +%150 ve üstü | Basamak basamak dikleşir |
| Balatro | 8. kattan sonra hedef puan: 110 bin, 560 bin, 7,2 milyon, 300 milyon, 47 milyar | 39. katta sayı taşar ve oyun biter |

Kaynaklar: [Brotato Wiki](https://brotato.wiki.spellsandguns.com/Endless_Mode), [Vampire Survivors Wiki](https://vampire.survivors.wiki/w/Stages), [Slay the Spire Wiki](https://slay-the-spire.fandom.com/wiki/Blights), [Nuclear Throne rehberi](https://idntg.pages.dev/areas), [Risk of Rain 2 Wiki](https://riskofrain2.wiki.gg/wiki/Difficulty), [Maxroll](https://maxroll.gg/d3/resources/greater-rift-explained), [Icy Veins](https://www.icy-veins.com/wow/news/mythic-plus-changes-in-tww-season-2/), [BTD6 topluluk rehberi](https://sarahs-btd6-site.onrender.com/guides/prologue/knowledge), [Balatro derlemesi](https://saschb2b.github.io/game-mechanics/games/balatro/blinds-and-bosses), [PC Gamer](https://www.pcgamer.com/games/roguelike/turns-out-that-balatro-like-tetris-before-it-can-only-be-finished-by-scoring-so-high-it-crashes-the-game). Bloons'un 250. turdan sonraki yüzdelerinde kaynaklar çelişiyor.

Asıl farkı yaratan, sayıların yanına eklenen kurallar:

- **Slay the Spire** her döngüde sırayla bir kural bozuyor: önce hazine odaları elit dövüşe dönüyor, sonra tur başına en çok 15 kart oynanabiliyor, sonra iyileşme yarıya iniyor. Boss sandıkları da ilk üçten sonra iki "blight"tan birini seçtiriyor ([Slay the Spire Wiki](https://slaythespire.wiki.gg/wiki/Custom_Mode)).
- **Nuclear Throne**'da her düşman, başka alanların canavarlarını içeren "döngü havuzundan" gelme şansı taşıyor: 1. döngüde %25, 2.'de %50, 3.'de %67. Hiçbir zaman %100 olmuyor. Elitler sıklaşıyor, 3. döngüden sonra bir düşman grubu tamamen daha güçlüsüyle değişiyor. Karşılığında altın ve "ultra" silahlar, döngüye özel taçlar ve yeni bir alan açılıyor ([rehber](https://idntg.pages.dev/areas)).
- **Risk of Rain 2**'de bir "yönetmen" her saniye kredi biriktirip canavar kartı satın alıyor. Parası yetiyorsa elit alıyor: 1. kademe elit 6 kat pahalı ve yaklaşık 4 kat canlı, 2. kademe 36 kat pahalı ve 18 kat canlı. Fazla ucuz kalan kartları atıyor; böylece oyun ilerledikçe ekrandaki sayı değil, canavarların türü ve ağırlığı değişiyor ([Risk of Rain 2 Wiki](https://riskofrain2.wiki.gg/wiki/Directors)).
- **Thronefall**'un sonsuz modu dalgaları gizli bir puan bütçesiyle üretiyor. Elitler 4 kat can ve 3 kat hasarla geliyor, dalga 200 birimi aşarsa düşmanlar elite birleşiyor, %1,7 ihtimalle tek türden oluşan bir savaş çıkıyor ([Thronefall Wiki](https://throne-fall.github.io/game-content/eternal-trials.html)).
- **How Many Dudes?** bu projeye en yakın örnek ve aynı hatayı yapıp düzeltti. Koşuların sabit bir sonu yok. 125. turdan sonra oyuncular "aynı dövüşün farklı güçlendirmelerle tekrarından" şikâyet edince geliştirici boss dövüşlerini rastgele ve giderek zorlaşan hale getirdi ve sonsuz moda özel dört yeni düşman ekledi ([Steam duyurusu](https://steamcommunity.com/app/3934270/allnews/), [oyuncu tartışması](https://steamcommunity.com/app/3934270/discussions/0/684118080246336791/)).
- **Mindustry**'nin dalga üreticisi çeşitliliği üst üste binen yaşam döngülerinden çıkarıyor: her düşman türü belli bir dalgada giriyor, birkaç dalgada bir sayısı artıyor, 8–16 dalga sonra emekliye ayrılıp yerini bir üst kademesine bırakıyor; %30 ihtimalle tür ailesi değişiyor; 30. dalgadan sonra her dalga kalkan ekliyor ([kaynak kod](https://raw.githubusercontent.com/Anuken/Mindustry/master/core/src/mindustry/game/Waves.java)).

## Oyuncunun ekonomisi de bilerek sıkıştırılıyor

Düşmanı büyütmek yetmiyor; zenginleşen oyuncunun kartopu etkisi de kesiliyor.

- **Brotato**'da 20. dalgadan sonra hasat her dalga %20 azalıyor, malzeme düşme şansı dalga başına %1,5 düşüyor (en az %50), eşya fiyatları endless factor ile çarpılıyor ve kumbara tamamen duruyor ([Brotato Wiki](https://brotato.wiki.spellsandguns.com/Endless_Mode)).
- **Bloons TD 6**'da patlatma başına para 51. turda %50'ye, sonra %20'ye, %10'a ve en sonunda %2'ye iniyor ([topluluk rehberi](https://sarahs-btd6-site.onrender.com/guides/prologue/knowledge)).
- **Risk of Rain 2**'de sandık fiyatı zorluk katsayısının 1,25. kuvvetiyle artıyor ([Risk of Rain 2 Wiki](https://riskofrain2.wiki.gg/wiki/Difficulty)).

Hordewall'da bunun tam tersi var: hasat her dalga %5 büyüyor ve faiz üstüne biniyor.

## Tempo düz bir rampa değil, testere dişi

Valve'ın Left 4 Dead sunumu bunu açıkça kurala bağlıyor. Yönetmen dört aşamadan geçiyor: tehdidi oyuncunun gerilimi eşiği aşana kadar artırıyor, zirveyi 3–5 saniye sürdürüyor, çatışma bitene kadar bekliyor, sonra 30–45 saniye boyunca neredeyse hiç tehdit göndermiyor. Sunumun gerekçesi şu: hiç değişmeyen çatışma yorar, uzun boşluk sıkar; ayarlanan şey zorluk değil, tempodur ([Michael Booth, Valve](https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)).

RimWorld aynı fikri günlerle uyguluyor. Cassandra adlı anlatıcı 4,6 gün saldırıp 6 gün ara veriyor. Saldırının gücü koloninin servetine bağlı, yani oyuncu güçlendikçe tehdit de büyüyor. Kolonist ölünce "uyum çarpanı" düşüyor (0,4 ile 1,47 arası) ve bir sonraki saldırı hafifliyor ([RimWorld Wiki](https://rimworldwiki.com/wiki/Raid_points), [Cassandra](https://rimworldwiki.com/wiki/Cassandra_Classic)).

## En sevilen zorluk, oyuncunun kendi seçtiği zorluk

Sonsuz ya da tavansız zorluk sunan oyunların çoğu, zorluğun ne şekilde artacağını oyuncuya seçtiriyor:

- **Hades**'in Pact of Punishment sistemi Slay the Spire'ın Ascension'ından esinlendi; amacı oyuncunun oyunun hangi yönden zorlaşacağını hassas biçimde ayarlaması ([Tom's Guide röportajı](https://www.tomsguide.com/features/hades-exclusive-interview-supergiant)).
- **Rogue Legacy 2**'de her yeni oyun+ seviyesi için oyuncu "yük" seçmek zorunda: 10. seviyeye kadar seviye başına iki, sonra bir ([yama notları](https://roguelegacy2.com/patchnotes/v040)).
- **GemCraft**'ta oyuncu bir dalgayı kendi eliyle "öfkelendirip" daha çok deneyim alıyor ([Steam](https://store.steampowered.com/app/1106530/GemCraft)).
- **Monster Train 2**'nin sonsuz modunda her savaştan sonra iki değiştiriciden biri seçiliyor ([rehber](https://deltiasgaming.com/?p=239524)).
- **The Tower**'da koşu içi tekliflerin %15'i takas: 1,5 kat hasar ama boss'lar 8 kat canlı gibi ([fan wiki](https://www.tower-hub.com/wiki/system/perks)).
- **WoW Mythic+** yalnızca ceza getiren eski kuralları bırakıp, iyi yönetildiğinde oyuncuyu güçlendiren haftalık "pazarlıklara" geçti ([Raider.io](https://raider.io/news/667-the-war-within-mythic-plus-affixes)).

Hordewall'un dalga seçimi zaten bu fikrin üstüne kurulu. Sonsuz kısımda aynı mantığı sürünün kalıcı değişimlerine de taşımak mümkün.

## Sonsuz modu sıkıcı yapan altı tuzak

1. **Aynı dövüş, daha büyük sayı.** How Many Dudes?'un ilk sonsuz modunun şikâyeti buydu. Can şişirmenin en yüksek hasarlı birkaç yapı dışında her şeyi geçersiz kıldığı da sık söyleniyor.
2. **Uzayan turlar.** Call of Duty Zombies'te tur başına zombi sayısı turun karesiyle artıyor. Dünya rekoru koşuda 50. tur 53. dakikada, 100. tur 2 saat 44. dakikada geçiliyor ([The Math of COD Zombies](https://jackhanke.github.io/posts/zombies)).
3. **Duran büyüme.** Plants vs. Zombies'in sonsuz modunda zombi sayısı yaklaşık 100. bayrakta artmayı bırakıyor; doğru dizilim binlerce bayrak dayanıyor ([PvZ Wiki](https://plantsvszombies.wiki.gg/wiki/Survival:_Endless)). Hordewall'un bugünkü hali bu.
4. **Ani duvar.** How Many Dudes? oyuncuları 115'ten 116'ya geçişte ordunun 10–15 saniyede silindiğini yazıyor ([tartışma](https://steamcommunity.com/app/3934270/discussions/0/590686232124729774/)). Brotato'nun ek çarpanı da 36. dalgada birden devreye giriyor.
5. **Risk artarken sabit kalan ödül.** Warframe'in sonsuz görevlerinde ödül sırası dört adımda başa dönüyor, düşman seviyesi ise artmaya devam ediyor; oyuncular bu yüzden 20. dakikada çıkıyor ([Warframe forumu](https://forums.warframe.com/topic/776215-endless-missions-reward-scaling-encourages-not-to-play-further-20-wavesminutes/)).
6. **Biten yapı.** Ordu tamamlanınca verilecek karar kalmıyor. Vampire Survivors bunu "Limit Break" ile çözdü: her şey en üst seviyeye gelince her seviye atlama bir silaha küçük, sınırsız bir artış veriyor ([wiki](https://vampire.survivors.wiki/w/Limit_Break)). Factorio sonsuz araştırmayı aynı gerekçeyle, getirisi azalan bir kaynak gideri olarak ekledi ([Friday Facts #161](https://cf-www.factorio.com/blog/post/fff-161)).

Bir de teknik sınır var: Vampire Survivors ekrandaki düşmanı 500'de, Thronefall dalgayı 200 birimde sınırlıyor; Bloons 80. turdan sonra balonları daha az ama daha dayanıklı hale getiriyor.

## Tavansız ilerlemenin dört modeli var

| Model | Örnekler | Nasıl çalışıyor | Artısı | Eksisi |
|---|---|---|---|---|
| Sınırsız zorluk merdiveni | Diablo 3 Greater Rift, Mythic+, Rogue Legacy 2 oyun+, Last Epoch, The Tower kademeleri | Oyuncu seviyeyi seçer; her seviye öncekinden zor ve daha çok ödül verir | Güç şişmesi yok, hedef hep var | Tek başına "büyüme" hissi vermez |
| Sınırsız küçük güç | Diablo 3 Paragon, Vampire Survivors altın yumurtaları, How Many Dudes? Dude Coin'leri | Her rütbe ya da satın alma küçük bir kalıcı bonus verir | Her koşu bir şey bırakır | Erken oyunu kolaylaştırır; bazı oyuncular "grind" diye sevmez |
| Rekora bağlı deneyim | GemCraft | Deneyim yalnızca kendi rekorunu geçtiğin kadar gelir | Tekrar değil, gelişme ödüllenir | Kötü koşu hiçbir şey vermez |
| Üretilen miras | Wildermyth efsane kahramanları, Kingdom Two Crowns varisleri | Her koşu yeni ve kalıcı bir şey üretir: bir kahraman, bir kayıt | İçerik bitmez, hikâye birikir | Güç hissi az |

Öne çıkan ayrıntılar:

- **Diablo 3** Paragon seviye sınırını 2.0 yamasıyla kaldırdı ([PC Gamer](https://www.pcgamer.com/diablo-3-paragon-reaper-souls)). Etkisi kendiliğinden sönüyor: Maxroll'a göre 1.000 ile 3.000 Paragon arasındaki fark yaklaşık 4 Greater Rift seviyesi ([Maxroll](https://maxroll.gg/d3/resources/greater-rifts)). Düşman seviye başına 1,17 kat büyüdüğü için üç kat emek gücü ikiye bile katlamıyor.
- **Vampire Survivors**'ta altın yumurta bir karaktere kalıcı ve küçük bir artış veriyor (örneğin +%1 güç), tanesi 10.000 altın ve pratikte sınırı yok ([wiki](https://vampire.survivors.wiki/w/Golden_Egg)).
- **GemCraft**'ta büyücü seviyesinin tavanı yok, ama bir bölümü tekrar oynamak yalnızca eski rekorla yeni rekor arasındaki fark kadar deneyim veriyor ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/GemCraft)).
- **The Tower**'da 24 kademe var; bir kademede 100. dalgaya ulaşmak sonrakini açıyor ve kademe arttıkça kazanç çarpanı büyüyor (1, 1,8, 2,6 ... 10. kademede 8,7). Güçlenen oyuncu baştan başlamak yerine daha zor kademeye geçiyor ([fan wiki](https://www.tower-hub.com/wiki/system/tiers)).
- **Wildermyth**'te kampanya bitince seçilen kahramanlar bir "miras" havuzuna terfi ediyor ve sonraki kampanyalarda geçmişleriyle birlikte geri gelebiliyor ([Wildermyth Wiki](https://wildermyth.com/wiki/Legacy)).
- **Idle oyunlar** tavansızlığı "prestij" ile kuruyor. Maliyet üstel, üretim polinom olduğu için oyuncu duvara çarpıyor; sıfırlayınca kazandığı kalıcı para ömür boyu kazancın kökü kadar oluyor (AdVenture Capitalist'te karekök, Cookie Clicker'da küpkök). Kalıcı parayı ikiye katlamak için öncekinin 4 ila 8 katı kazanmak gerekiyor ([The Math of Idle Games I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i), [III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)).

Oyuncuların kalıcı güce bakışı bölünmüş durumda. Eleştiri hep aynı: yeterince kaybedince oyun beceri istemeden geçiliyor ([ResetEra](https://www.resetera.com/threads/im-starting-to-feel-that-stat-based-meta-progression-is-starting-to-ruin-roguelites-generally-speaking.1509337/)). Önceki araştırmamızda da en çok övülen model yatay ilerlemeydi. Bu eleştiri, sonu olan bir oyun için geçerli. Sonu olmayan ve düşmanın katlanarak büyüdüğü bir oyunda kalıcı güç oyunu bitirmiyor, yalnızca rekoru biraz ileri taşıyor.

## Bunlar Hordewall için ne anlama geliyor

Araştırmadan çıkan ve kararını benim verebileceğim taslak şöyle:

- **Üç saat.** Dalga (seçtiğin teklif), bölüm (8 dalga ve bir boss) ve devir (4 boss, 32 dalga). İlk devir bugünkü oyunun kendisi: dört çağ ve dört boss. Zafer ekranı kalkar; her devrin sonu bir kutlama ve büyük bir ödül olur, koşu durmaz.
- **Her saat başka bir şeyi değiştirir.** Dalgada bileşim ve değiştirici; bölümde sürünün kalıcı bir değişimi; devirde boss'ların yeni güçleri, yeni elit türleri ve yeni canavarlar.
- **Düşman katlanarak büyür.** İlk 32 dalganın dengesi korunur. Sonrasında can ve hasar dalga başına sabit bir yüzdeyle artar, ani çarpan olmaz. Canavar sayısı sınırlı kalır, fazlası elite ve şampiyona döner; dalga süresi uzamaz.
- **Ekonomi sınırlanır.** Hasadın bileşik büyümesi ve faiz sonsuzda patlamayacak şekilde bağlanır.
- **Yapı hiç bitmez.** Altın Çağ'dan sonra da seviye sınırlarını açan bir yol gerekir.
- **Ödül riskle birlikte büyür.** Derine indikçe hem koşu içi ödül hem şöhret artar.
- **Hedef rekordur.** Her lord ve kuşatma seviyesi için en derin dalga, düşen kalelerin kaydı.

Bir uyarı: önceki araştırmada en çok sevilen oyunlar 15–30 dakikalık, net bir sonu olan koşular sunuyordu ve sonsuz mod orada bir seçenekti. Zaferi tamamen kaldırmak bu çoğunluk eğiliminin dışına çıkmak demek. Bunu dengelemenin yolu, devir sonlarını gerçek birer kilometre taşı yapmak.

Senin karar vermen gerekenler:

1. Kale düşünce koşu mu bitsin, yoksa aynı kaleyle mi devam edilsin?
2. Tavansız ilerleme hangi modellere dayansın, kalıcı güç olsun mu?
3. Her turu farklı kılmak için hangi sistemler eklensin?
4. Tipik bir koşu ne kadar sürsün?
5. Altın Çağ'dan sonra boss'lar ne açsın?

## Bilerek dışarıda bıraktıklarım

- **"Nemesis" tarzı, oyuncuyu hatırlayıp terfi eden düşmanlar.** Warner Bros.'un bu sistem üzerinde 2035'e kadar geçerli bir patenti var ([Patent Arcade](https://www.patentarcade.com/2021/02/warner-brothers-granted-patent-for-nemesis-system-from-middle-earth-video-games.html)). Adı ve rastgele güçleri olan şampiyonlar yapılabilir; oyuncuyla geçmişine göre değişen bir düşman hiyerarşisi yapmıyorum.
- **Çevrimiçi sıralama.** Sunucu ve yayınlama gerektiriyor; oyun yayına çıkınca ayrıca konuşulur.
- **Boşta ilerleme (idle).** Oyun kapalıyken kazanç bu türün değil, mobil idle oyunların kuralı.
