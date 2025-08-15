/* ---------------------------------------------------------------
   calculator.js  (linked from the HTML with <script src="…">)
   ---------------------------------------------------------------*/

// ─── 0. Toggle custom vs default cost UI ──────────────────────
document.getElementById("useCustomCost").addEventListener("change", () => {
  const useCustom = document.getElementById("useCustomCost").checked;
  document.getElementById("customCostContainer").style.display   = useCustom ? "block" : "none";
  document.getElementById("defaultCostContainer").style.display  = useCustom ? "none"  : "block";
  });

// ─── 1. Generate AI decision report via ChatGPT ─────────────────
async function generateReport(metrics) {
  const responseEl = document.getElementById("decisionText");
  const pdfBtn     = document.getElementById("downloadDecisionPdf");
  responseEl.textContent = "Generating AI report…";
  pdfBtn.style.display = "none";

  let resp;
  try {
    resp = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics })
    });
  } catch (err) {
    responseEl.textContent = "Network error: " + err.message;
    return;
  }

  if (!resp.ok) {
    const text = await resp.text();
    responseEl.textContent = `Error ${resp.status}: ${text}`;
    return;
  }

  const contentType = resp.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = await resp.json();
    } catch (err) {
      const text = await resp.text();
      responseEl.textContent = "Invalid JSON response: " + text;
      return;
    }
  } else {
    const text = await resp.text();
    responseEl.textContent = "Non-JSON response: " + text;
    return;
  }

  if (data.error) {
    responseEl.textContent = data.error;
    return;
  }

  responseEl.innerHTML = data.report;
  pdfBtn.style.display = "inline-block";
  pdfBtn.onclick = () => downloadDecisionPdf();
}

// ─── 2. Download decision report as PDF ────────────────────────
async function downloadDecisionPdf() {
  const el = document.getElementById("decisionText");
  const canvas = await html2canvas(el, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth  = pdf.internal.pageSize.getWidth();
  const imgProps   = pdf.getImageProperties(imgData);
  const pageHeight = (imgProps.height * pageWidth) / imgProps.width;

  pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
  pdf.save("decision-report.pdf");
}

// ─── 3. Core calculate() – compute metrics then invoke AI report ─
function calculate() {
  /* ---------- 1. READ INPUTS ---------- */
  const Pnew       = parseFloat(document.getElementById("Additionalcapacity").value) || 0;
  const useCustom  = document.getElementById("useCustomCost").checked;

  let Ctype, Region;
  if (useCustom) {
    Ctype  = parseFloat(document.getElementById("CustomCost").value) || 0;
    Region = 1;
  } else {
    Ctype  = parseFloat(document.getElementById("plantType").value) || 0;
    Region = parseFloat(document.getElementById("region").value)    || 0;
  }

  const Cinfra   = parseFloat(document.getElementById("Costinfra").value)   || 0;
  const Nmeters  = parseFloat(document.getElementById("Numberofcust").value)|| 0;
  const Cmeters  = parseFloat(document.getElementById("Costmeters").value)  || 0;
  const H        = parseFloat(document.getElementById("Hoursperday").value) || 0;
  const Ttariff  = parseFloat(document.getElementById("Tariff").value)       || 0;
  const Ssavings = parseFloat(document.getElementById("Ssavings").value)     || 0;
  const r        = parseFloat(document.getElementById("Discount").value)    || 0;
  const L        = parseFloat(document.getElementById("Lifespan").value)    || 0;

  /* ---------- 2. CORE FORMULAS ---------- */
  const Cplant        = Pnew * Ctype * Region;
  const Csmart        = Cinfra + ((Nmeters * Cmeters) / 5);
  const Rplant        = Pnew * H * Ttariff * 365 * 1000;
  const Ssmart        = Rplant * (Ssavings / 100);
  const revenuesmart  = Rplant + Ssmart;
  const ROIplant      = (Rplant / (Cplant || 1)) * 100;
  const ROIsmart      = (revenuesmart / (Csmart || 1)) * 100;

  let NPVplant = -Cplant;
  let NPVsmart = -Csmart;
  for (let t = 1; t <= L; t++) {
    NPVplant += Rplant / Math.pow(1 + r, t);
    NPVsmart += revenuesmart / Math.pow(1 + r, t);
  }

  /* ---------- 3. WRITE RESULTS (non-AI) ---------- */
  document.getElementById("NewPlantResult").textContent        =
    Cplant ? `$${Cplant.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("UgradePlantResult").textContent     =
    Csmart ? `$${Csmart.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("NewPlantRevenueResult").textContent =
    Rplant ? `$${Rplant.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("AnnualSavingsResult").textContent   =
    Ssmart ? `$${Ssmart.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("Smartrevenue").textContent         =
    revenuesmart ? `$${revenuesmart.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("roiOutput").textContent            =
    `Plant: ${ROIplant.toFixed(2)} % | Smart Grid: ${ROIsmart.toFixed(2)} %`;
  document.getElementById("npvOutput").textContent            =
    `Plant: $${NPVplant.toFixed(2)} | Smart Grid: $${NPVsmart.toFixed(2)}`;

  /* ---------- 4. Invoke AI report generation ---------- */
  generateReport({ Cplant, Csmart, Rplant, revenuesmart, ROIplant, ROIsmart, NPVplant, NPVsmart });
}

/* ---------- 5. CLEAR FORM (optional) ---------- */
function clearForm() {
  document.querySelectorAll("input[type='number']").forEach(el => el.value = "");
  document.getElementById("useCustomCost").checked            = false;
  document.getElementById("customCostContainer").style.display   = "none";
  document.getElementById("defaultCostContainer").style.display = "block";
  document.getElementById("regionContainer").style.display       = "block";
  document.querySelectorAll("output").forEach(el => el.textContent = "--");
  document.getElementById("decisionText").textContent =
    "Decision summary will appear here based on ROI and NPV results.";
  document.getElementById("downloadDecisionPdf").style.display = "none";
}
