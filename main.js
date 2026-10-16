
(() => {
  "use strict";

  const JADWAL = {
    buka: 7 * 60 + 30, // 07.30, dalam menit sejak tengah malam
    tutup: 15 * 60, // 15.00
    hariKerja: [1, 2, 3, 4, 5], // 0 = Minggu, 1 = Senin, ... 6 = Sabtu

    // Tanggal libur (hari raya, libur sekolah) dengan format "TTTT-BB-HH".
    // Contoh: libur: ["2026-10-20", "2026-12-25"]
    libur: [],
  };

  const NAMA_HARI = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ];
  const SELISIH_WITA = 8 * 60 * 60 * 1000;
  const SEHARI = 24 * 60 * 60 * 1000;

  // Tanggal/jam yang dibaca lewat getUTC...() adalah jam dinding WITA.
  const waktuWita = (ms) => new Date(ms + SELISIH_WITA);
  const tanggalIso = (d) => d.toISOString().slice(0, 10);
  const hariBuka = (d) =>
    JADWAL.hariKerja.includes(d.getUTCDay()) &&
    !JADWAL.libur.includes(tanggalIso(d));

  const formatJam = (menit) => {
    const jam = String(Math.floor(menit / 60)).padStart(2, "0");
    const mnt = String(menit % 60).padStart(2, "0");
    return `${jam}.${mnt}`;
  };

  function hitungStatus(ms) {
    const sekarang = waktuWita(ms);
    const menit = sekarang.getUTCHours() * 60 + sekarang.getUTCMinutes();

    // Sedang buka
    if (hariBuka(sekarang) && menit >= JADWAL.buka && menit < JADWAL.tutup) {
      const sisa = JADWAL.tutup - menit;
      return sisa <= 30
        ? {
            state: "soon",
            teks: `Segera tutup, pukul ${formatJam(JADWAL.tutup)} WITA`,
          }
        : {
            state: "open",
            teks: `Buka sekarang, tutup pukul ${formatJam(JADWAL.tutup)} WITA`,
          };
    }

    // Tutup: cari hari buka berikutnya (maksimal 2 minggu ke depan)
    for (let i = 0; i < 15; i++) {
      const hari = waktuWita(ms + i * SEHARI);
      if (!hariBuka(hari)) continue;
      if (i === 0 && menit >= JADWAL.buka) continue; // hari ini sudah lewat jam tutup
      const kapan =
        i === 0 ? "hari ini" : i === 1 ? "besok" : NAMA_HARI[hari.getUTCDay()];
      return {
        state: "closed",
        teks: `Tutup sekarang, buka lagi ${kapan} pukul ${formatJam(JADWAL.buka)} WITA`,
      };
    }
    return { state: "closed", teks: "Tutup sekarang" };
  }

  function pasangStatusBuka() {
    const el = document.getElementById("status-buka");
    if (!el) return;
    const teks = el.querySelector(".open-text");

    const perbarui = () => {
      const status = hitungStatus(Date.now());
      el.dataset.state = status.state;
      teks.textContent = status.teks;
      el.hidden = false; // tersembunyi di HTML sampai JS berhasil menghitung
    };

    perbarui();
    setInterval(perbarui, 60 * 1000);
  }

  /* ======================================================================
     2. KATALOG: PENCARIAN + FILTER
     Cara kerja: setiap kartu buku punya data-category dan data-status.
     Chip kategori dibuat otomatis dari data-category, jadi menambah buku
     dengan kategori baru tidak perlu mengubah JavaScript.
     ====================================================================== */
  const normalisasi = (teks) =>
    teks
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // buang tanda aksen
      .replace(/\s+/g, " ")
      .trim();

  function pasangKatalog() {
    const form = document.querySelector(".search-box");
    const input = document.getElementById("cari-buku");
    const grid = document.querySelector(".book-grid");
    const wadahFilter = document.getElementById("filter-box");
    const jumlah = document.getElementById("jumlah-hasil");
    const kosong = document.getElementById("buku-kosong");
    const tombolReset = document.getElementById("reset-filter");
    if (!form || !input || !grid || !wadahFilter || !jumlah || !kosong) return;

    const kartu = [...grid.querySelectorAll(".book-card")];
    if (kartu.length === 0) return;

    // Teks yang dicari: judul + penulis + kategori
    kartu.forEach((k) => {
      const bagian = [
        k.querySelector("h3")?.textContent,
        k.querySelector(".book-author")?.textContent,
        k.querySelector(".book-category")?.textContent,
      ];
      k.dataset.cari = normalisasi(bagian.filter(Boolean).join(" "));
    });

    const awal = { q: "", kategori: "semua", tersedia: false };
    const state = { ...awal };

    // --- Chip filter -------------------------------------------------
    const chipKategori = [];
    let chipTersedia = null;

    const buatChip = (label, saatKlik) => {
      const tombol = document.createElement("button");
      tombol.type = "button";
      tombol.className = "filter";
      tombol.textContent = label;
      tombol.setAttribute("aria-pressed", "false");
      tombol.addEventListener("click", saatKlik);
      wadahFilter.appendChild(tombol);
      return tombol;
    };

    const daftarKategori = new Map();
    kartu.forEach((k) => {
      const slug = k.dataset.category;
      if (slug && !daftarKategori.has(slug)) {
        const label =
          k.querySelector(".book-category")?.textContent.trim() || slug;
        daftarKategori.set(slug, label);
      }
    });

    chipKategori.push({
      slug: "semua",
      el: buatChip("Semua", () => {
        state.kategori = "semua";
        terapkan();
      }),
    });
    daftarKategori.forEach((label, slug) => {
      chipKategori.push({
        slug,
        el: buatChip(label, () => {
          state.kategori = slug;
          terapkan();
        }),
      });
    });

    const pemisah = document.createElement("span");
    pemisah.className = "filter-sep";
    pemisah.setAttribute("aria-hidden", "true");
    wadahFilter.appendChild(pemisah);

    chipTersedia = buatChip("Hanya yang tersedia", () => {
      state.tersedia = !state.tersedia;
      terapkan();
    });

    // --- Menerapkan filter ------------------------------------------
    function terapkan() {
      const kata = normalisasi(state.q).split(" ").filter(Boolean);
      let tampil = 0;

      kartu.forEach((k) => {
        const cocok =
          (state.kategori === "semua" ||
            k.dataset.category === state.kategori) &&
          (!state.tersedia || k.dataset.status === "tersedia") &&
          kata.every((kt) => k.dataset.cari.includes(kt));
        k.hidden = !cocok;
        if (cocok) tampil++;
      });

      chipKategori.forEach(({ slug, el }) =>
        el.setAttribute("aria-pressed", String(slug === state.kategori)),
      );
      chipTersedia.setAttribute("aria-pressed", String(state.tersedia));

      // textContent (bukan innerHTML) supaya ketikan pengguna tidak
      // pernah dibaca sebagai HTML.
      jumlah.textContent = state.q.trim()
        ? `Menampilkan ${tampil} dari ${kartu.length} buku untuk "${state.q.trim()}"`
        : `Menampilkan ${tampil} dari ${kartu.length} buku`;
      kosong.hidden = tampil !== 0;

      simpanKeUrl();
    }

    // Simpan pencarian di alamat halaman, sehingga bisa dibagikan
    // dan tetap ada saat halaman dimuat ulang.
    function simpanKeUrl() {
      try {
        const param = new URLSearchParams();
        if (state.q.trim()) param.set("q", state.q.trim());
        if (state.kategori !== "semua") param.set("kategori", state.kategori);
        if (state.tersedia) param.set("tersedia", "1");
        const qs = param.toString();
        history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
      } catch (galat) {
        /* Beberapa browser menolak replaceState pada file:// : abaikan */
      }
    }

    function aturUlang() {
      Object.assign(state, awal);
      input.value = "";
      terapkan();
      input.focus();
    }

    // --- Peristiwa --------------------------------------------------
    input.addEventListener("input", () => {
      state.q = input.value;
      terapkan();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault(); // hasil sudah tampil langsung, tidak perlu memuat ulang
      state.q = input.value;
      terapkan();
    });

    if (tombolReset) tombolReset.addEventListener("click", aturUlang);

    // --- Nilai awal dari alamat halaman (?q=...&kategori=...) ---------
    const param = new URLSearchParams(location.search);
    state.q = param.get("q") || "";
    const kat = param.get("kategori");
    if (kat && daftarKategori.has(kat)) state.kategori = kat;
    state.tersedia = param.get("tersedia") === "1";
    input.value = state.q;

    terapkan();
  }

  /* ====================================================================== */
  pasangStatusBuka();
  pasangKatalog();
})();
