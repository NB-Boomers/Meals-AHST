/**
 * KANTINKU HR - FRONTEND APPLICATION LOGIC
 * Ganti DEFAULT_GAS_URL di bawah dengan URL Web App Google Apps Script kamu (/exec),
 * atau atur langsung lewat tombol Pengaturan di dalam aplikasi.
 */
const DEFAULT_GAS_URL = "";

const STORAGE_KEYS = {
  GAS_URL: "kantinku_gas_url",
  EMP_NAME: "kantinku_emp_name",
  EMP_DEPT: "kantinku_emp_dept",
  ADMIN_PIN: "kantinku_admin_session_pin"
};

let state = {
  isAdmin: false,
  adminPin: "",
  period: "today",
  customStart: "",
  customEnd: "",
  rawData: {
    absen: [],
    saran: [],
    catring: []
  },
  charts: {
    compare: null,
    trend: null,
    catringCat: null,
    saranCat: null
  }
};

/* =========================================================
   1. INISIALISASI SAAT HALAMAN DIMUAT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  updateLiveClock();
  setInterval(updateLiveClock, 15000);

  initDefaultFormDatesAndTimes();
  restoreSavedEmployeeProfile();
  checkGasUrlConfig();
  bindAllEvents();

  // Cek apakah sesi admin masih aktif di tab ini
  const savedSessionPin = sessionStorage.getItem(STORAGE_KEYS.ADMIN_PIN);
  if (savedSessionPin) {
    state.isAdmin = true;
    state.adminPin = savedSessionPin;
    activateAdminUI();
    fetchAdminDashboardData();
  }
});

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function getGasUrl() {
  return localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL;
}

function checkGasUrlConfig() {
  const url = getGasUrl();
  const banner = document.getElementById("apiConfigBanner");
  const inputSettings = document.getElementById("inputGasUrl");
  if (inputSettings) inputSettings.value = url;

  if (!url || !url.startsWith("https://script.google.com/")) {
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

function getTodayStr() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getCurrentTimeStr() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function updateLiveClock() {
  const now = new Date();
  const options = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
  const datePart = now.toLocaleDateString("id-ID", options);
  const timePart = getCurrentTimeStr();
  document.getElementById("liveClockLabel").textContent = `${datePart} • ${timePart} WIB`;
}

function initDefaultFormDatesAndTimes() {
  const today = getTodayStr();
  const timeNow = getCurrentTimeStr();

  document.getElementById("absenTanggal").value = today;
  document.getElementById("absenJam").value = timeNow;
  document.getElementById("saranTanggal").value = today;
  document.getElementById("catTanggal").value = today;
  document.getElementById("admAbsenTanggal").value = today;
  document.getElementById("admAbsenJam").value = timeNow;
  document.getElementById("filterStartDate").value = today;
  document.getElementById("filterEndDate").value = today;
}

function restoreSavedEmployeeProfile() {
  const savedName = localStorage.getItem(STORAGE_KEYS.EMP_NAME);
  const savedDept = localStorage.getItem(STORAGE_KEYS.EMP_DEPT);

  if (savedName) {
    document.getElementById("empNama").value = savedName;
    document.getElementById("saranNama").value = savedName;
    document.getElementById("savedNameHint").classList.remove("hidden");
    document.getElementById("btnResetSavedName").classList.remove("hidden");
  }
  if (savedDept) {
    document.getElementById("empDepartemen").value = savedDept;
    document.querySelectorAll("#deptChips .chip").forEach(c => {
      c.classList.toggle("active", c.dataset.val === savedDept);
    });
  }
}

/* =========================================================
   2. EVENT LISTENERS (INTERAKSI TOMBOL & FORM)
   ========================================================= */
function bindAllEvents() {
  // Switcher Tab Karyawan (Absen vs Saran)
  document.querySelectorAll("[data-emp-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-emp-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.empTab;
      document.getElementById("tabAbsen").classList.toggle("hidden", target !== "tabAbsen");
      document.getElementById("tabSaran").classList.toggle("hidden", target !== "tabSaran");
    });
  });

  // Shift Card Selector (Absen Makan)
  document.querySelectorAll("#absenShiftGrid .shift-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll("#absenShiftGrid .shift-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      document.getElementById("absenShiftVal").value = card.dataset.shift;
    });
  });

  // Departemen Chips
  document.querySelectorAll("#deptChips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#deptChips .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      document.getElementById("empDepartemen").value = chip.dataset.val;
    });
  });

  // Reset Saved Name
  document.getElementById("btnResetSavedName").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.EMP_NAME);
    localStorage.removeItem(STORAGE_KEYS.EMP_DEPT);
    document.getElementById("empNama").value = "";
    document.getElementById("empDepartemen").value = "";
    document.getElementById("savedNameHint").classList.add("hidden");
    document.getElementById("btnResetSavedName").classList.add("hidden");
    document.getElementById("empNama").focus();
  });

  // Kategori Saran (3 Kategori Baku)
  document.querySelectorAll("#saranCategoryGrid .cat-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll("#saranCategoryGrid .cat-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      document.getElementById("saranKategoriVal").value = card.dataset.cat;
    });
  });

  // Shift Chips di Form Saran
  document.querySelectorAll("#saranShiftChips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#saranShiftChips .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      document.getElementById("saranShiftVal").value = chip.dataset.val;
    });
  });

  // Quick Complaint Chips
  document.querySelectorAll("#quickComplaintChips .chip-outline").forEach(chip => {
    chip.addEventListener("click", () => {
      const textarea = document.getElementById("saranIsi");
      textarea.value = chip.dataset.text;
    });
  });

  // Checkbox Anonim
  document.getElementById("chkAnonim").addEventListener("change", (e) => {
    const inputNama = document.getElementById("saranNama");
    if (e.target.checked) {
      inputNama.value = "Anonim";
      inputNama.disabled = true;
    } else {
      inputNama.value = localStorage.getItem(STORAGE_KEYS.EMP_NAME) || "";
      inputNama.disabled = false;
    }
  });

  // Submit Form Absen Karyawan
  document.getElementById("formAbsenKaryawan").addEventListener("submit", handleEmployeeAbsenSubmit);

  // Submit Form Saran Karyawan
  document.getElementById("formSaranKaryawan").addEventListener("submit", handleEmployeeSaranSubmit);

  // Modal PIN Admin
  document.getElementById("btnOpenPinModal").addEventListener("click", () => {
    if (state.isAdmin) return;
    document.getElementById("inputAdminPin").value = "";
    openModal("modalPin");
    setTimeout(() => document.getElementById("inputAdminPin").focus(), 120);
  });

  document.getElementById("formVerifyPin").addEventListener("submit", handleAdminLogin);

  // Kunci / Keluar Admin
  document.getElementById("btnLockAdmin").addEventListener("click", () => {
    state.isAdmin = false;
    state.adminPin = "";
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_PIN);
    deactivateAdminUI();
    showToast("Mode Admin dikunci. Kembali ke Mode Karyawan.", "success");
  });

  // Bottom Navigation Admin
  document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".bottom-nav .nav-item").forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      const targetTab = item.dataset.adminTab;
      document.querySelectorAll(".admin-section").forEach(sec => sec.classList.add("hidden"));
      document.getElementById(targetTab).classList.remove("hidden");
    });
  });

  // FAB "+ Tambah Transaksi" Admin
  document.getElementById("btnOpenQuickAdd").addEventListener("click", () => {
    initDefaultFormDatesAndTimes();
    openModal("modalQuickAdd");
  });

  // Switcher Form di dalam Modal "+ Tambah"
  document.querySelectorAll("[data-admin-form]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-form]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.adminForm;
      document.getElementById("formCatringAdmin").classList.toggle("hidden", target !== "formBoxCatring");
      document.getElementById("formAbsenManualAdmin").classList.toggle("hidden", target !== "formBoxAdminAbsen");
    });
  });

  // Chips Kategori Menu Catering
  document.querySelectorAll("#catMenuChips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#catMenuChips .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      document.getElementById("catKategoriMenu").value = chip.dataset.val;
    });
  });

  // Submit Catring Tersedia
  document.getElementById("formCatringAdmin").addEventListener("submit", handleAdminCatringSubmit);

  // Submit Absen Manual Admin
  document.getElementById("formAbsenManualAdmin").addEventListener("submit", handleAdminManualAbsenSubmit);

  // Period Filter Buttons
  document.querySelectorAll("#periodPills .period-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#periodPills .period-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.period = btn.dataset.period;

      const customBox = document.getElementById("customDateRange");
      if (state.period === "custom") {
        customBox.classList.remove("hidden");
      } else {
        customBox.classList.add("hidden");
        renderAdminAnalyticsAndHistory();
      }
    });
  });

  document.getElementById("btnApplyCustomDate").addEventListener("click", () => {
    state.customStart = document.getElementById("filterStartDate").value;
    state.customEnd = document.getElementById("filterEndDate").value;
    renderAdminAnalyticsAndHistory();
  });

  // Refresh Data Admin
  document.getElementById("btnRefreshData").addEventListener("click", fetchAdminDashboardData);

  // History Search & Filter
  document.getElementById("historySearch").addEventListener("input", renderHistoryList);
  document.getElementById("historyTypeFilter").addEventListener("change", renderHistoryList);
  document.getElementById("historySubFilter").addEventListener("change", renderHistoryList);

  // Setup API URL Modals & Settings
  document.getElementById("btnQuickSetupApi").addEventListener("click", () => {
    document.getElementById("modalInputGasUrl").value = getGasUrl();
    openModal("modalApiSetup");
  });

  document.getElementById("btnModalSaveGasUrl").addEventListener("click", () => {
    const val = document.getElementById("modalInputGasUrl").value.trim();
    saveGasUrl(val);
    closeModal("modalApiSetup");
  });

  document.getElementById("btnSaveGasUrl").addEventListener("click", () => {
    const val = document.getElementById("inputGasUrl").value.trim();
    saveGasUrl(val);
  });

  // Print QR Code
  document.getElementById("btnPrintQr").addEventListener("click", () => window.print());

  // Close Modals
  document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
}

function saveGasUrl(url) {
  if (!url.startsWith("https://script.google.com/")) {
    showToast("URL tidak valid. Harus diawali https://script.google.com/", "error");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.GAS_URL, url);
  checkGasUrlConfig();
  showToast("URL Google Apps Script berhasil disimpan!", "success");
}

/* =========================================================
   3. KOMUNIKASI API KE GOOGLE APPS SCRIPT (CORS-SAFE)
   ========================================================= */
async function callGasApi(payload, loadingMsg = "Memproses...") {
  const url = getGasUrl();
  if (!url) {
    showToast("Atur URL Google Apps Script terlebih dahulu!", "error");
    openModal("modalApiSetup");
    throw new Error("URL API belum dikonfigurasi");
  }

  showLoader(loadingMsg);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result;
  } finally {
    hideLoader();
  }
}

/* =========================================================
   4. HANDLER TRANSAKSI INPUT (KARYAWAN & ADMIN)
   ========================================================= */
async function handleEmployeeAbsenSubmit(e) {
  e.preventDefault();
  const nama = document.getElementById("empNama").value.trim();
  const departemen = document.getElementById("empDepartemen").value.trim() || "-";
  const shift = document.getElementById("absenShiftVal").value;
  const jamMakan = document.getElementById("absenJam").value;
  const tanggal = document.getElementById("absenTanggal").value;
  const catatan = document.getElementById("absenCatatan").value.trim();

  if (!nama) {
    showToast("Silakan isi Nama Lengkap Karyawan.", "warning");
    document.getElementById("empNama").focus();
    return;
  }

  try {
    const res = await callGasApi({
      action: "submitAbsen",
      data: { nama, departemen, shift, jamMakan, tanggal, catatan }
    }, "Mencatat absen makan...");

    if (res.status === "success") {
      // Simpan nama & departemen di HP karyawan agar kunjungan berikutnya < 5 detik
      localStorage.setItem(STORAGE_KEYS.EMP_NAME, nama);
      if (departemen !== "-") localStorage.setItem(STORAGE_KEYS.EMP_DEPT, departemen);
      restoreSavedEmployeeProfile();

      document.getElementById("absenCatatan").value = "";
      document.getElementById("absenJam").value = getCurrentTimeStr();
      showToast(res.message, "success");
    } else if (res.status === "duplicate") {
      showToast(res.message, "warning");
    } else {
      showToast(res.message || "Gagal menyimpan absen.", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server. Periksa koneksi internet.", "error");
  }
}

async function handleEmployeeSaranSubmit(e) {
  e.preventDefault();
  const kategori = document.getElementById("saranKategoriVal").value;
  const shift = document.getElementById("saranShiftVal").value;
  const isAnonim = document.getElementById("chkAnonim").checked;
  const nama = isAnonim ? "Anonim" : (document.getElementById("saranNama").value.trim() || "Anonim");
  const isi = document.getElementById("saranIsi").value.trim();
  const tanggal = document.getElementById("saranTanggal").value;

  if (!isi) {
    showToast("Tuliskan detail keluhan atau saran terlebih dahulu.", "warning");
    document.getElementById("saranIsi").focus();
    return;
  }

  try {
    const res = await callGasApi({
      action: "submitSaran",
      data: { kategori, shift, nama, isi, tanggal }
    }, "Mengirim masukan...");

    if (res.status === "success") {
      document.getElementById("saranIsi").value = "";
      showToast(res.message, "success");
    } else {
      showToast(res.message || "Gagal mengirim masukan.", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server.", "error");
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById("inputAdminPin").value.trim();
  if (!pin) return;

  try {
    const res = await callGasApi({ action: "verifyPin", pin }, "Memverifikasi PIN Admin...");
    if (res.status === "success" && res.valid) {
      state.isAdmin = true;
      state.adminPin = pin;
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_PIN, pin);
      closeModal("modalPin");
      activateAdminUI();
      showToast("Selamat datang di Mode Admin!", "success");
      await fetchAdminDashboardData();
    } else {
      showToast(res.message || "PIN Admin salah!", "error");
    }
  } catch (err) {
    showToast("Gagal memverifikasi PIN. Periksa koneksi.", "error");
  }
}

async function handleAdminCatringSubmit(e) {
  e.preventDefault();
  const tanggal = document.getElementById("catTanggal").value;
  const shift = document.getElementById("catShift").value;
  const kategoriMenu = document.getElementById("catKategoriMenu").value.trim();
  const jumlahPorsi = document.getElementById("catJumlahPorsi").value;
  const catatan = document.getElementById("catCatatan").value.trim();

  if (!jumlahPorsi || Number(jumlahPorsi) <= 0) {
    showToast("Masukkan jumlah porsi catering yang valid.", "warning");
    return;
  }

  try {
    const res = await callGasApi({
      action: "submitCatring",
      pin: state.adminPin,
      data: { tanggal, shift, kategoriMenu, jumlahPorsi, catatan }
    }, "Menyimpan stok catering...");

    if (res.status === "success") {
      document.getElementById("catJumlahPorsi").value = "";
      document.getElementById("catCatatan").value = "";
      closeModal("modalQuickAdd");
      showToast(res.message, "success");
      await fetchAdminDashboardData();
    } else {
      showToast(res.message || "Gagal menyimpan stok catering.", "error");
    }
  } catch (err) {
    showToast("Terjadi gangguan koneksi.", "error");
  }
}

async function handleAdminManualAbsenSubmit(e) {
  e.preventDefault();
  const nama = document.getElementById("admAbsenNama").value.trim();
  const shift = document.getElementById("admAbsenShift").value;
  const jamMakan = document.getElementById("admAbsenJam").value;
  const tanggal = document.getElementById("admAbsenTanggal").value;
  const departemen = document.getElementById("admAbsenDept").value.trim() || "-";
  const catatan = document.getElementById("admAbsenCatatan").value.trim();

  if (!nama) {
    showToast("Nama karyawan wajib diisi.", "warning");
    return;
  }

  try {
    const res = await callGasApi({
      action: "submitAbsen",
      data: { nama, departemen, shift, jamMakan, tanggal, catatan }
    }, "Menyimpan absen manual...");

    if (res.status === "success") {
      document.getElementById("admAbsenNama").value = "";
      document.getElementById("admAbsenCatatan").value = "";
      closeModal("modalQuickAdd");
      showToast(res.message, "success");
      await fetchAdminDashboardData();
    } else {
      showToast(res.message || "Gagal menyimpan absen.", "error");
    }
  } catch (err) {
    showToast("Terjadi gangguan koneksi.", "error");
  }
}

/* =========================================================
   5. TAMPILAN ADMIN, FILTER PERIODE, INSIGHT & GRAFIK
   ========================================================= */
function activateAdminUI() {
  document.getElementById("employeeView").classList.add("hidden");
  document.getElementById("adminView").classList.remove("hidden");
  document.getElementById("btnLockAdmin").classList.remove("hidden");
  document.getElementById("roleBadgeText").textContent = "Mode Admin";
  document.getElementById("roleDot").classList.add("admin");
  generateCanteenQrCode();
}

function deactivateAdminUI() {
  document.getElementById("adminView").classList.add("hidden");
  document.getElementById("employeeView").classList.remove("hidden");
  document.getElementById("btnLockAdmin").classList.add("hidden");
  document.getElementById("roleBadgeText").textContent = "Mode Karyawan";
  document.getElementById("roleDot").classList.remove("admin");
}

function generateCanteenQrCode() {
  const container = document.getElementById("qrcodeCanvas");
  container.innerHTML = "";
  const cleanAppUrl = window.location.origin + window.location.pathname;
  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: cleanAppUrl,
      width: 190,
      height: 190,
      colorDark: "#0F172A",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}

async function fetchAdminDashboardData() {
  try {
    const res = await callGasApi({
      action: "getDashboardData",
      pin: state.adminPin
    }, "Menyinkronkan data spreadsheet...");

    if (res.status === "success" && res.data) {
      state.rawData = res.data;
      renderAdminAnalyticsAndHistory();
    } else {
      showToast(res.message || "Gagal memuat data.", "error");
    }
  } catch (err) {
    showToast("Tidak dapat memuat data dari Google Sheets.", "error");
  }
}

function getDateRanges() {
  const todayStr = getTodayStr();
  const todayDate = new Date(todayStr + "T00:00:00");
  let start, end, prevStart, prevEnd;

  if (state.period === "today") {
    start = end = todayStr;
    const prev = new Date(todayDate);
    prev.setDate(prev.getDate() - 1);
    prevStart = prevEnd = formatDateObj(prev);
  } else if (state.period === "week") {
    const dayOfWeek = todayDate.getDay() === 0 ? 7 : todayDate.getDay(); // Senin = 1
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() - (dayOfWeek - 1));
    start = formatDateObj(monday);
    end = todayStr;

    const pEnd = new Date(monday);
    pEnd.setDate(pEnd.getDate() - 1);
    const pStart = new Date(pEnd);
    pStart.setDate(pStart.getDate() - 6);
    prevStart = formatDateObj(pStart);
    prevEnd = formatDateObj(pEnd);
  } else if (state.period === "month") {
    start = todayStr.slice(0, 8) + "01";
    end = todayStr;

    const prevMonthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
    const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
    prevStart = formatDateObj(prevMonthStart);
    prevEnd = formatDateObj(prevMonthEnd);
  } else {
    start = state.customStart || todayStr;
    end = state.customEnd || todayStr;
    const diffDays = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
    const pEnd = new Date(start + "T00:00:00");
    pEnd.setDate(pEnd.getDate() - 1);
    const pStart = new Date(pEnd);
    pStart.setDate(pStart.getDate() - (diffDays - 1));
    prevStart = formatDateObj(pStart);
    prevEnd = formatDateObj(pEnd);
  }

  return { start, end, prevStart, prevEnd };
}

function formatDateObj(d) {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function filterByRange(list, start, end) {
  return list.filter(item => item.tanggal >= start && item.tanggal <= end);
}

function renderAdminAnalyticsAndHistory() {
  const { start, end, prevStart, prevEnd } = getDateRanges();

  const absenCurr = filterByRange(state.rawData.absen, start, end);
  const saranCurr = filterByRange(state.rawData.saran, start, end);
  const catringCurr = filterByRange(state.rawData.catring, start, end);
  const absenPrev = filterByRange(state.rawData.absen, prevStart, prevEnd);

  // 1. Update KPI Summary Cards
  const totalMakan = absenCurr.length;
  const totalCatring = catringCurr.reduce((sum, item) => sum + (Number(item.jumlahPorsi) || 0), 0);
  const totalSaran = saranCurr.length;
  const selisihPorsi = totalCatring - totalMakan;
  const porsiHabisCount = saranCurr.filter(s => s.kategori === "Porsi Habis").length;

  document.getElementById("kpiTotalMakan").textContent = `${totalMakan} Org`;
  document.getElementById("kpiTotalCatring").textContent = `${totalCatring} Porsi`;
  document.getElementById("kpiTotalSaran").textContent = `${totalSaran}`;

  const selisihEl = document.getElementById("kpiSelisihPorsi");
  if (selisihPorsi >= 0) {
    selisihEl.textContent = `Sisa +${selisihPorsi} porsi aman`;
    selisihEl.classList.remove("warn");
  } else {
    selisihEl.textContent = `Kurang ${Math.abs(selisihPorsi)} porsi!`;
    selisihEl.classList.add("warn");
  }

  document.getElementById("kpiPorsiHabisCount").textContent = `${porsiHabisCount} keluhan porsi habis`;

  // 2. Hitung & Render Insights
  renderInsights(absenCurr, absenPrev, catringCurr, totalMakan, totalCatring, selisihPorsi, porsiHabisCount);

  // 3. Render Charts
  renderAllCharts(absenCurr, catringCurr, saranCurr);

  // 4. Render History List
  renderHistoryList();
}

function renderInsights(absenCurr, absenPrev, catringCurr, totalMakan, totalCatring, selisihPorsi, porsiHabisCount) {
  // A. Kategori Catring Terbesar
  const catMap = {};
  catringCurr.forEach(c => {
    const key = c.kategoriMenu || "Reguler";
    catMap[key] = (catMap[key] || 0) + (Number(c.jumlahPorsi) || 0);
  });
  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    const [topName, topQty] = sortedCats[0];
    const pct = totalCatring > 0 ? Math.round((topQty / totalCatring) * 100) : 0;
    document.getElementById("insightTopCatring").textContent = `${topName} (${topQty} Porsi)`;
    document.getElementById("insightTopCatringDesc").textContent = `Menyumbang ${pct}% dari total pasokan catering periode ini.`;
  } else {
    document.getElementById("insightTopCatring").textContent = "Belum ada data catering";
    document.getElementById("insightTopCatringDesc").textContent = "Tambahkan stok catering lewat tombol + di bawah.";
  }

  // B. Rata-rata Karyawan Harian
  const uniqueDays = new Set(absenCurr.map(a => a.tanggal)).size;
  const avgDaily = uniqueDays > 0 ? (totalMakan / uniqueDays).toFixed(1) : 0;
  document.getElementById("insightAvgDaily").textContent = `${avgDaily} Karyawan / Hari`;
  document.getElementById("insightAvgDailyDesc").textContent = `Dihitung dari ${uniqueDays} hari operasional makan pada periode ini.`;

  // C. Perbandingan dengan Periode Sebelumnya
  const prevCount = absenPrev.length;
  let diffText = "Sama dengan periode sebelumnya";
  if (prevCount === 0 && totalMakan > 0) {
    diffText = `+100% dibanding periode sebelumnya (0 org)`;
  } else if (prevCount > 0) {
    const pctChange = Math.round(((totalMakan - prevCount) / prevCount) * 100);
    const sign = pctChange >= 0 ? "+" : "";
    diffText = `${sign}${pctChange}% (${totalMakan} vs ${prevCount} org)`;
  }
  document.getElementById("insightPeriodCompare").textContent = diffText;
  document.getElementById("kpiMakanTrend").textContent = diffText;

  // D. Kesehatan Stok & Peringatan Porsi Habis
  const healthTitle = document.getElementById("insightStockHealth");
  const healthDesc = document.getElementById("insightStockHealthDesc");
  if (selisihPorsi < 0 || porsiHabisCount > 0) {
    healthTitle.textContent = "⚠️ Peringatan Kekurangan Porsi Terdeteksi";
    healthDesc.textContent = `Terdapat ${porsiHabisCount} keluhan porsi habis dan selisih ${selisihPorsi} porsi. Pertimbangkan tambah kuota catering.`;
  } else if (totalCatring > 0 && totalMakan / totalCatring >= 0.9) {
    healthTitle.textContent = "⚡ Utilisasi Tinggi (≥ 90% Terpakai)";
    healthDesc.textContent = `Tersisa ${selisihPorsi} porsi cadangan. Siapkan buffer ekstra jika ada lembur.`;
  } else {
    healthTitle.textContent = "✅ Stok Porsi Terkendali";
    healthDesc.textContent = "Kapasitas catering mencukupi kebutuhan makan karyawan.";
  }
}

function renderAllCharts(absenCurr, catringCurr, saranCurr) {
  if (typeof Chart === "undefined") return;

  // Agregasi per tanggal untuk Grafik Perbandingan & Tren
  const dateSet = new Set([
    ...absenCurr.map(a => a.tanggal),
    ...catringCurr.map(c => c.tanggal)
  ]);
  const sortedDates = Array.from(dateSet).sort();

  const absenPerDate = sortedDates.map(d => absenCurr.filter(a => a.tanggal === d).length);
  const catringPerDate = sortedDates.map(d =>
    catringCurr.filter(c => c.tanggal === d).reduce((s, x) => s + (Number(x.jumlahPorsi) || 0), 0)
  );
  const shortLabels = sortedDates.map(d => d.slice(5)); // MM-DD

  // Chart 1: Grouped Bar (Absen Makan vs Catring Tersedia)
  destroyChart("compare");
  const ctxCompare = document.getElementById("chartCompareMain").getContext("2d");
  state.charts.compare = new Chart(ctxCompare, {
    type: "bar",
    data: {
      labels: shortLabels.length ? shortLabels : ["Belum ada data"],
      datasets: [
        {
          label: "Catring Tersedia (Porsi)",
          data: catringPerDate.length ? catringPerDate : [0],
          backgroundColor: "#4F46E5",
          borderRadius: 6
        },
        {
          label: "Absen Makan (Karyawan)",
          data: absenPerDate.length ? absenPerDate : [0],
          backgroundColor: "#0D9488",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  // Chart 2: Line Trend Absen Makan
  destroyChart("trend");
  const ctxTrend = document.getElementById("chartTrendLine").getContext("2d");
  state.charts.trend = new Chart(ctxTrend, {
    type: "line",
    data: {
      labels: shortLabels.length ? shortLabels : ["Belum ada data"],
      datasets: [{
        label: "Karyawan Makan",
        data: absenPerDate.length ? absenPerDate : [0],
        borderColor: "#0D9488",
        backgroundColor: "rgba(13, 148, 136, 0.14)",
        fill: true,
        tension: 0.35,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  // Chart 3: Porsi Catring per Kategori Menu
  const catMenuTotals = {};
  catringCurr.forEach(c => {
    catMenuTotals[c.kategoriMenu] = (catMenuTotals[c.kategoriMenu] || 0) + (Number(c.jumlahPorsi) || 0);
  });
  destroyChart("catringCat");
  const ctxCatring = document.getElementById("chartCatringCategory").getContext("2d");
  state.charts.catringCat = new Chart(ctxCatring, {
    type: "doughnut",
    data: {
      labels: Object.keys(catMenuTotals).length ? Object.keys(catMenuTotals) : ["Kosong"],
      datasets: [{
        data: Object.values(catMenuTotals).length ? Object.values(catMenuTotals) : [1],
        backgroundColor: ["#4F46E5", "#0D9488", "#06B6D4", "#8B5CF6", "#F59E0B"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" } }
    }
  });

  // Chart 4: Sebaran 3 Kategori Keluhan
  const saranCounts = [
    saranCurr.filter(s => s.kategori === "Porsi Habis").length,
    saranCurr.filter(s => s.kategori === "Rasa/Menu").length,
    saranCurr.filter(s => s.kategori === "Kebersihan").length
  ];
  destroyChart("saranCat");
  const ctxSaran = document.getElementById("chartSaranCategory").getContext("2d");
  state.charts.saranCat = new Chart(ctxSaran, {
    type: "bar",
    data: {
      labels: ["Porsi Habis", "Rasa/Menu", "Kebersihan"],
      datasets: [{
        label: "Jumlah Laporan",
        data: saranCounts,
        backgroundColor: ["#DC2626", "#F59E0B", "#0D9488"],
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

/* =========================================================
   6. RIWAYAT TRANSAKSI (READ-ONLY, SEARCH & FILTER)
   ========================================================= */
function renderHistoryList() {
  const { start, end } = getDateRanges();
  const keyword = document.getElementById("historySearch").value.trim().toLowerCase();
  const typeFilter = document.getElementById("historyTypeFilter").value;
  const subFilter = document.getElementById("historySubFilter").value;

  const combined = [];

  if (typeFilter === "ALL" || typeFilter === "ABSEN") {
    filterByRange(state.rawData.absen, start, end).forEach(a => {
      combined.push({
        type: "ABSEN",
        badgeClass: "tag-absen",
        badgeText: "Absen Makan",
        sortKey: a.timestamp || `${a.tanggal} ${a.jamMakan}`,
        timeText: `${a.tanggal} • ${a.jamMakan}`,
        title: `${a.nama} (${a.shift})`,
        desc: `Dept: ${a.departemen}${a.catatan ? " • Catatan: " + a.catatan : ""}`,
        shiftOrCat: a.shift
      });
    });
  }

  if (typeFilter === "ALL" || typeFilter === "CATRING") {
    filterByRange(state.rawData.catring, start, end).forEach(c => {
      combined.push({
        type: "CATRING",
        badgeClass: "tag-catring",
        badgeText: "Catring Tersedia",
        sortKey: c.timestamp || c.tanggal,
        timeText: `${c.tanggal} • Shift ${c.shift}`,
        title: `+${c.jumlahPorsi} Porsi — ${c.kategoriMenu}`,
        desc: c.catatan || "Stok catering masuk",
        shiftOrCat: c.shift
      });
    });
  }

  if (typeFilter === "ALL" || typeFilter === "SARAN") {
    filterByRange(state.rawData.saran, start, end).forEach(s => {
      combined.push({
        type: "SARAN",
        badgeClass: "tag-saran",
        badgeText: s.kategori,
        sortKey: s.timestamp || s.tanggal,
        timeText: `${s.tanggal} • Shift ${s.shift}`,
        title: `Dari: ${s.nama}`,
        desc: s.isi,
        shiftOrCat: s.kategori
      });
    });
  }

  const filtered = combined
    .filter(item => {
      if (subFilter !== "ALL" && item.shiftOrCat !== subFilter) return false;
      if (keyword) {
        const hay = `${item.title} ${item.desc} ${item.badgeText}`.toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.sortKey > a.sortKey ? 1 : -1));

  const container = document.getElementById("historyListContainer");
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <strong>Tidak ada data ditemukan</strong>
        <p>Coba ubah filter periode, kategori, atau kata kunci pencarian.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <article class="history-card">
      <div class="history-top">
        <span class="history-tag ${item.badgeClass}">${escapeHtml(item.badgeText)}</span>
        <span class="history-time">${escapeHtml(item.timeText)}</span>
      </div>
      <div class="history-title">${escapeHtml(item.title)}</div>
      <div class="history-desc">${escapeHtml(item.desc)}</div>
    </article>
  `).join("");
}

/* =========================================================
   7. UTILITAS UI (MODAL, TOAST, LOADER, ESCAPE HTML)
   ========================================================= */
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function showLoader(text = "Memproses...") {
  document.getElementById("loaderText").textContent = text;
  document.getElementById("globalLoader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("globalLoader").classList.add("hidden");
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 3800);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
