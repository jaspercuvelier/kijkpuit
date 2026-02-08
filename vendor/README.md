# Lokale libraries (local-first)

Plaats hier deze bestanden met exact deze namen:

- `tailwindcss.cdn.js`
- `QRCode.js`
- `html5-qrcode.js`

De app laadt eerst deze lokale files.
Als een file ontbreekt, valt de app automatisch terug op CDN.

Aanbevolen bronnen/versies:

- Tailwind CDN script: `https://cdn.tailwindcss.com`
- QRCode.js 1.0.0: `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`
- html5-qrcode: `https://unpkg.com/html5-qrcode`

Tip:
Wil je 100% vastgepinde versies zonder CDN-fallback?
Zorg dat alle drie lokale bestanden aanwezig zijn en wijzig desgewenst de fallback scripts in `index.html`.
