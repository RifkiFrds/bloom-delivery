# Bloom Delivery — Panduan Menjalankan

Panduan praktis untuk menjalankan proyek ini di lokal.
Versi bahasa Inggris: [README.md](./README.md) · Panduan rilis: [docs/RUNBOOK.md](./docs/RUNBOOK.md)

---

## Apa ini?

Sebuah web experience: dua orang membentuk **hati dengan satu tangan
masing-masing** di depan kamera, lalu bunga dikirimkan dan sebuah surat terbuka.

> **Hadiahnya selalu sampai.** Gesturnya cuma menentukan seberapa berkesan
> momen sampainya — bukan apakah dia sampai atau tidak. Ada tiga tingkat
> keringanan (_mercy_) dan tombol darurat yang selalu bisa diakses.

---

## 1. Yang perlu disiapkan

| Kebutuhan | Versi                                           |
| --------- | ----------------------------------------------- |
| Node.js   | **>= 20.11**                                    |
| pnpm      | terbaru                                         |
| Browser   | Chrome / Safari terbaru                         |
| Kamera    | wajib untuk alur utama (ada jalur tanpa kamera) |

Cek dulu:

```bash
node -v     # harus v20.11 ke atas
pnpm -v
```

---

## 2. Instalasi

```bash
pnpm install
pnpm vision:fetch
```

`pnpm vision:fetch` mengunduh model MediaPipe (**±7,7 MB**) ke `public/vision/`.
Model ini **di-host sendiri, tidak lewat CDN** — supaya tidak ada koneksi ke
server pihak ketiga sama sekali.

Kalau langkah ini dilewat, deteksi wajah dan tangan tidak akan jalan.

---

## 3. Menjalankan

### Untuk dites di HP (yang benar)

```bash
pnpm dev:https
```

Lalu buka di HP:

```
https://<IP-laptop-kamu>:3000/d/coba
```

> ⚠️ **Wajib HTTPS.** `getUserMedia` (akses kamera) hanya jalan di _secure
> context_. Lewat `http://<ip-laptop>` kameranya **tidak akan pernah muncul** —
> ini bukan bug, ini aturan browser.

Sertifikatnya _self-signed_, jadi HP akan kasih peringatan sekali. Tap
**"Advanced"** → **"Proceed"**. Laptop dan HP harus satu jaringan WiFi.

Cari IP laptop:

```bash
ipconfig            # Windows — cari "IPv4 Address"
ifconfig | grep inet   # macOS / Linux
```

### Untuk cek tampilan saja di laptop

```bash
pnpm dev
```

Buka `http://localhost:3000/d/coba`. UI-nya jalan normal, tapi bagian kamera
tidak bisa dites dengan benar.

### Kenapa URL-nya `/d/<sesuatu>`?

Halaman utama (`/`) sengaja kosong dan **tidak menautkan ke mana-mana**.
Kerahasiaan URL itulah kontrol aksesnya. Bagian `<sesuatu>` bebas — untuk
pengiriman asli, pakai yang tidak bisa ditebak, misalnya `/d/7fq2m9x`.

---

## 4. Mode debug

```
https://<ip>:3000/d/coba?debug=1
```

Menampilkan HUD deteksi:

- nilai **setiap kondisi C1–C7** beserta angka terukur dan ambang batasnya
- `S` (palm scale) per tangan — angka paling penting di proyek ini
- waktu inferensi p50/p95, Hz efektif, penghitung re-render React
- tingkat cahaya (`luma Y`), status coaching, progres hold
- tombol **force unlock** dan pemaksaan **mercy level 0/1/2/3**

Ada juga panel FSM di kanan bawah: state sekarang, 10 event terakhir, dan
tombol lompat ke state mana pun. Sangat berguna untuk mengecek layar error
tanpa harus benar-benar membuat errornya.

### Menguji sendirian — `?solo=1`

```
https://<ip>:3000/d/coba?solo=1&debug=1
```

Gerbang kebersamaan turun dari **dua wajah ke satu**, jadi kamu bisa menjalani
seluruh alur tanpa orang kedua. **Tidak ada lagi yang berubah**: jendela N-of-M
8-of-10 yang sama, filter wajah yang sama, efek `detection.enableHands` yang
asli, hold timer yang asli, tangga mercy yang asli.

Untuk hatinya, **dua tanganmu sendiri sah**. Handedness diabaikan sepenuhnya
(Doc 03 §2.5) — tidak ada satu pun kondisi yang memeriksa tangan itu milik
siapa. Sandarkan HP atau pakai laptop supaya kedua tangan bebas.

> **Kenapa jangan pakai tombol lompat panel debug untuk ini.** Melompat itu
> melewati reducer, jadi efeknya tidak ikut jalan — dulu tahap gestur tiba
> dengan model tangan mati, dan itu terlihat persis seperti hand tracking rusak.
> Sudah diperbaiki, tapi `?solo=1` tetap cara yang jujur: pipeline aslinya
> benar-benar berjalan.

Flag ini **mati total di build produksi** (`NODE_ENV`), sama seperti `?debug=1`.
Tidak ada versi yang tersimpan dan tidak ada toggle di dalam aplikasi — flag
yang bertahan setelah reload adalah flag yang orang lupa masih menyala.

> Tanpa HUD ini gesturnya tidak bisa dikalibrasi. Kalau gerakan tidak terdeteksi,
> HUD akan bilang persis kondisi mana yang gagal, misalnya `C5 0.031 >= 0.048`.

---

## 5. Daftar perintah

| Perintah         | Fungsi                                                        |
| ---------------- | ------------------------------------------------------------- |
| `pnpm dev`       | Server dev (HTTP)                                             |
| `pnpm dev:https` | Server dev HTTPS — **pakai ini untuk tes kamera**             |
| `pnpm build`     | Build produksi                                                |
| `pnpm start`     | Menjalankan hasil build                                       |
| `pnpm verify`    | `typecheck` + `lint` + `test` + `budgets`                     |
| `pnpm test`      | Unit test (Vitest)                                            |
| `pnpm e2e`       | End-to-end test (Playwright)                                  |
| `pnpm budgets`   | Cek budget aset & JavaScript — **jalankan `pnpm build` dulu** |
| `pnpm fixtures`  | Mengindeks rekaman landmark untuk uji deteksi                 |
| `pnpm spike`     | Alat ukur Phase 0 (untuk merekam klip kalibrasi)              |

---

## 6. Sebelum benar-benar dikirim

Empat hal ini harus diisi dulu:

### a. Tulis suratnya

`src/content/letter.ts` → ubah `LETTER_PLAIN`.

```ts
export const LETTER_LANG = 'id'; // ← ganti kalau suratnya bahasa Indonesia

export const LETTER_PLAIN = `Paragraf pertama.

Paragraf kedua.`;
```

Pisahkan paragraf dengan **baris kosong** — setiap paragraf muncul satu per satu.
`LETTER_LANG` wajib sesuai bahasa aslinya, kalau tidak pembaca layar akan
melafalkan teks Indonesia dengan aksen Inggris.

### b. Nama penerima

Lewat query string:

```
https://.../d/coba?to=Alya
```

Divalidasi otomatis (maks. 24 karakter, mendukung huruf non-Latin) dan selalu
dirender sebagai _text node_ — aman dari injeksi.
Kalau kosong, tampil "Someone Special".

### c. Audio _(opsional)_

Taruh di `public/audio/`:

- `sfx-sprite.webm` + `sfx-sprite.m4a`
- `music.webm` + `music.m4a`

Titik waktu spritenya sudah ditentukan di `src/audio/sprite.ts`.

**Kalau file ini tidak ada, aplikasi berjalan tanpa suara** dan itu memang
perilaku yang dirancang — semua suara di sini sifatnya dekoratif, tidak ada
informasi yang cuma disampaikan lewat audio.

### d. Slug URL

Ganti `coba` dengan sesuatu yang tidak bisa ditebak.

---

## 7. Kalau ada masalah

**Kamera tidak muncul di HP**
Pastikan pakai `pnpm dev:https` dan alamatnya `https://`, bukan `http://`.
Ini penyebab nomor satu.

**Sudah HTTPS tapi tetap tidak bisa**
Peringatan sertifikat sudah di-_proceed_? Laptop dan HP satu WiFi? Firewall
Windows kadang memblokir port 3000 — izinkan saat diminta.

**Deteksi tangan tidak jalan**
Jalankan `pnpm vision:fetch`. Cek `public/vision/hand_landmarker.task` ada dan
ukurannya ±7,5 MB.

**`pnpm budgets` gagal dengan angka aneh (misal 1,7 MB)**
Isi `.next` masih build dev. Jalankan `pnpm build` dulu, baru `pnpm budgets`.

**Build gagal dengan `WasmHash` / `Cannot read properties of undefined`**
Cache webpack korup. Hapus dan build ulang:

```bash
rm -rf .next && pnpm build
```

**Link dibuka dari WhatsApp/Instagram lalu kamera tidak bisa**
Itu memang perilaku yang benar. Browser dalam aplikasi (in-app browser) diblokir
lebih dulu dan muncul layar khusus yang mengarahkan ke browser asli.

---

## 8. Struktur folder

```
src/machine/     state machine — dilarang impor React, Zustand, Three, Motion
src/detection/   kamera, MediaPipe, matematika gestur (fungsi murni)
src/scenes/      satu komponen per state
src/scene3d/     adegan 3D — hanya bisa diakses lewat scenes/Scene3D.tsx
src/lite/        versi 2D dari adegan yang sama (jalur cadangan)
src/content/     letter.ts (isi suratnya) dan copy.ts (semua teks)
```

Batasan antar folder **ditegakkan oleh ESLint**, bukan sekadar kesepakatan.
Mengimpor React ke dalam `machine/` akan menggagalkan `pnpm lint`.

---

## 9. Catatan penting

- **Tidak ada data yang dikirim ke mana pun.** CSP `connect-src 'self'`
  memblokir semua koneksi keluar secara struktural. Kamera tidak pernah
  meninggalkan perangkat.
- **Kamera mati otomatis** maksimal 120 detik, dan langsung dimatikan begitu
  gesturnya berhasil.
- **Selalu ada jalan keluar.** Setiap layar error punya tombol menuju surat.
  Tombol darurat muncul di detik ke-45 dan jadi tombol utama di detik ke-90 —
  tapi tidak pernah menekan dirinya sendiri.

Sebelum benar-benar dikirim, baca [docs/RUNBOOK.md](./docs/RUNBOOK.md) —
di situ ada daftar hal yang **belum diukur** dan hanya bisa diuji di perangkat
asli.
