// script.js
// App Scrivi & Ascolta - disegno, OCR con Tesseract, TTS italiana con scelta voce, modalità stampatello

const canvas = document.getElementById("handwritingCanvas");
const statusEl = document.getElementById("status");
const recognisedTextArea = document.getElementById("recognizedText");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const clearTextBtn = document.getElementById("clearTextBtn");
const recogniseBtn = document.getElementById("recogniseBtn");
const recogniseUpperBtn = document.getElementById("recogniseUpperBtn");
const readAloudBtn = document.getElementById("readAloudBtn");
const fontSizeRange = document.getElementById("fontSizeRange");
const fontSizeValue = document.getElementById("fontSizeValue");
const voiceSelect = document.getElementById("voiceSelect");

console.log("Canvas trovato?", canvas);

let ctx;
let drawing = false;
let lastX = 0;
let lastY = 0;

// ---------------------------
// Inizializzazione canvas
// ---------------------------

function initCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx = canvas.getContext("2d");
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#000000";

  clearCanvas();
}

function clearCanvas() {
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  setStatus("Pronto");
}

function setStatus(text) {
  statusEl.textContent = text;
}

function getCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

// ---------------------------
// Eventi mouse (PC)
// ---------------------------

canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  drawing = true;
  const { x, y } = getCanvasCoords(e.clientX, e.clientY);
  lastX = x;
  lastY = y;
  setStatus("Sto disegnando…");
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  e.preventDefault();
  const { x, y } = getCanvasCoords(e.clientX, e.clientY);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  lastX = x;
  lastY = y;
});

window.addEventListener("mouseup", () => {
  if (drawing) {
    drawing = false;
    setStatus("Pronto");
  }
});

// ---------------------------
// Eventi touch (tablet future)
// ---------------------------

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      drawing = true;
      const t = e.touches[0];
      const { x, y } = getCanvasCoords(t.clientX, t.clientY);
      lastX = x;
      lastY = y;
      setStatus("Sto disegnando…");
    }
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!drawing || e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0];
    const { x, y } = getCanvasCoords(t.clientX, t.clientY);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    drawing = false;
    setStatus("Pronto");
  },
  { passive: false }
);

// ---------------------------
// Riconoscimento (OCR Tesseract)
// ---------------------------

async function recogniseHandwriting(asUppercase = false) {
  if (typeof Tesseract === "undefined") {
    alert("Libreria Tesseract.js non caricata (controlla la connessione Internet).");
    return;
  }

  setStatus("Riconoscimento in corso… (può richiedere alcuni secondi)");

  try {
    const dataUrl = canvas.toDataURL("image/png");

    const result = await Tesseract.recognize(dataUrl, "ita", {
      logger: (m) => console.log(m)
    });

    let text = result.data.text || "";

    text = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();

    text = autoCorrectText(text);

    if (asUppercase) {
      text = text.toUpperCase();
    }

    recognisedTextArea.value = text;
    setStatus("Riconoscimento completato");
  } catch (err) {
    console.error(err);
    setStatus("Errore nel riconoscimento");
    alert("Si è verificato un errore nel riconoscimento della scrittura.");
  }
}

// Autocorrezione semplice
function autoCorrectText(text) {
  const corrections = {
    "0ui": "qui",
    "perche": "perché",
    "pero": "però",
    "ancnra": "ancora",
    "buongiorrno": "buongiorno"
    // aggiungi qui altre coppie "sbagliato": "giusto"
  };

  let corrected = text;

  for (const wrong in corrections) {
    const right = corrections[wrong];
    const regex = new RegExp("\\b" + wrong + "\\b", "gi");
    corrected = corrected.replace(regex, right);
  }

  if (corrected.length > 0) {
    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
  }

  return corrected;
}

// ---------------------------
// TTS: lettura ad alta voce con scelta voce
// ---------------------------

let availableVoices = [];
let currentVoice = null;

function populateVoiceList() {
  if (!("speechSynthesis" in window)) {
    alert("Sintesi vocale non supportata in questo browser.");
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return;
  }

  // Filtra solo voci italiane
  availableVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith("it")
  );

  if (!availableVoices.length) {
    voiceSelect.innerHTML = "<option>Nessuna voce italiana trovata</option>";
    currentVoice = null;
    return;
  }

  voiceSelect.innerHTML = "";
  availableVoices.forEach((v, index) => {
    const opt = document.createElement("option");
    opt.value = index.toString();
    opt.textContent = v.name;
    voiceSelect.appendChild(opt);
  });

  // Scegli come default una voce più "naturale" se disponibile
  let defaultIndex = 0;
  const nicePatterns = /(Google|Natural|Neural|Online)/i;
  const niceIndex = availableVoices.findIndex((v) => nicePatterns.test(v.name));
  if (niceIndex !== -1) {
    defaultIndex = niceIndex;
  }

  voiceSelect.value = defaultIndex.toString();
  currentVoice = availableVoices[defaultIndex];
}

function initVoices() {
  if (!("speechSynthesis" in window)) {
    alert("Sintesi vocale non supportata in questo browser.");
    return;
  }
  populateVoiceList();
  window.speechSynthesis.onvoiceschanged = populateVoiceList;
}

voiceSelect.addEventListener("change", () => {
  const idx = parseInt(voiceSelect.value, 10);
  currentVoice = availableVoices[idx] || null;
});

function readTextAloud() {
  const text = recognisedTextArea.value.trim();
  if (!text) {
    alert("Non c'è testo da leggere.");
    return;
  }

  if (!("speechSynthesis" in window)) {
    alert("Sintesi vocale non supportata in questo browser.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "it-IT";
  utterance.rate = 1;
  utterance.pitch = 1.0;

  if (currentVoice) {
    utterance.voice = currentVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// ---------------------------
// Controlli UI
// ---------------------------

clearCanvasBtn.addEventListener("click", clearCanvas);

clearTextBtn.addEventListener("click", () => {
  recognisedTextArea.value = "";
  setStatus("Testo cancellato");
});

recogniseBtn.addEventListener("click", () => recogniseHandwriting(false));

recogniseUpperBtn.addEventListener("click", () => recogniseHandwriting(true));

readAloudBtn.addEventListener("click", readTextAloud);

fontSizeRange.addEventListener("input", () => {
  const size = fontSizeRange.value;
  recognisedTextArea.style.fontSize = size + "px";
  fontSizeValue.textContent = size + " px";
});

// ---------------------------
// Avvio
// ---------------------------

window.addEventListener("load", () => {
  initCanvas();
  initVoices();
});

window.addEventListener("resize", () => {
  initCanvas();
});
