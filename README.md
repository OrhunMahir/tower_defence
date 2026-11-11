# Kale savunma (çalışma adı)

1–4 kişilik co-op kale savunma oyunu. Sunucu oyunun bütün kurallarını yürütür; tarayıcı sadece girdi yollar ve 3B sahneyi çizer.

- `npm install` — bağımlılıklar (`ws`, `three`)
- `npm start` — sunucu, http://127.0.0.1:3000 (ağdaki arkadaşlar için `HOST=0.0.0.0 npm start`)
- `npm test` — bot simülasyonu ile kural testleri
- `node server/index.js --dev` — test modu: G = 500 altın ve bir seviye, H = sıradaki dalga Kraliçe dalgası, K = iç kalenin canı 60'a iner

Klasörler: `server/game.js` kurallar, `server/index.js` HTTP + WebSocket, `client/` 3B istemci, `test/` simülasyon testleri, `stil-demo.html` ilk görsel demo.
