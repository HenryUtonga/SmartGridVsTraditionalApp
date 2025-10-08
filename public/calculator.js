/* ---------------------------------------------------------------
   calculator.js  (linked from the HTML with <script src="…">)
   ---------------------------------------------------------------*/
let myChart = null;

// ─── 0. Toggle custom vs default cost UI ──────────────────────
document.getElementById("useCustomCost").addEventListener("change", () => {
  const useCustom = document.getElementById("useCustomCost").checked;
  document.getElementById("customCostContainer").style.display = useCustom ? "block" : "none";
  document.getElementById("defaultCostContainer").style.display = useCustom ? "none" : "block";
});

// ─── Generate AI decision report via ChatGPT ─────────────────
async function generateReport(metrics) {
  const responseEl = document.getElementById("decisionText");
  const pdfBtn = document.getElementById("downloadDecisionPdf");
  responseEl.textContent = "Generating AI report…";
  pdfBtn.style.display = "none";

  try {
    const resp = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics })
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    responseEl.innerHTML = data.report;
    pdfBtn.style.display = "inline-block";
    pdfBtn.onclick = () => downloadDecisionPdf();
  } catch (err) {
    responseEl.textContent = "Error: " + err.message;
  }
}

// ─── Download decision report as PDF (continuous, proper pagination) ────────────────────────
async function downloadDecisionPdf() {
  const el = document.getElementById("decisionText");
  const { jsPDF } = window.jspdf;

  // Capture the entire decision area as one large canvas
 const canvas = await html2canvas(el, {
  scale: 2,                 // lower scale (no need for 3x)
  width: 794,               // match CSS width
  windowWidth: 794,
  useCORS: true,
  backgroundColor: "#ffffff"
});

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20; // 10mm margin on each side
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let position = 10;
  let heightLeft = imgHeight;

  // First page
  pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  // Add new pages if content overflows
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  // Save the final file
  pdf.save("Investment_Report.pdf");
}


function calculate() {
  /* ---------- 1. READ INPUTS ---------- */
  const cprod = parseFloat(document.getElementById("currentprod").value) || 0;
  const useCustom = document.getElementById("useCustomCost").checked;
  const Pnew = parseFloat(document.getElementById("Additionalcapacity").value) || 0;

  let Ctype, Region;
  if (useCustom) {
    Ctype = parseFloat(document.getElementById("CustomCost").value) || 0;
    Region = 1;
  } else {
    Ctype = parseFloat(document.getElementById("plantType").value) || 0;
    Region = parseFloat(document.getElementById("region").value) || 0;
  }

  const UsersPerMeter = parseFloat(document.getElementById("UsersPerMeter").value) || 1;
  const Cinfra = parseFloat(document.getElementById("Costinfra").value) || 0;
  const Nmeters = parseFloat(document.getElementById("Numberofcust").value) || 0;
  const Cmeters = parseFloat(document.getElementById("Costmeters").value) || 0;
  const H = parseFloat(document.getElementById("Hoursperday").value) || 0;
  const Ttariff = parseFloat(document.getElementById("Tariff").value) || 0;
  const Ssavings = parseFloat(document.getElementById("Ssavings").value) || 0;
  const r = (parseFloat(document.getElementById("Discount").value) || 0) / 100;
  const L = parseFloat(document.getElementById("Lifespan").value) || 0;

  if (L <= 0) {
    alert("Please enter a valid project lifespan (years).");
    return;
  }

  /* ---------- 2. COSTS ---------- */
  const Cplant = Pnew * Ctype * Region;
  const Csmart = Cinfra + ((Nmeters * Cmeters) / UsersPerMeter);

  /* ---------- 3. REVENUE FLOWS ---------- */
  const Pnew_kW = Pnew * 1000;
  const cprod_kW = cprod * 1000;

  // Plant revenue (gross)
  const PlantGrossAnnual = Pnew_kW * H * Ttariff * 365;

  // Smart grid = only incremental savings
  const SmartBaseAnnual = cprod_kW * H * Ttariff * 365;
  const SmartSavingsAnnual = SmartBaseAnnual * (Ssavings / 100);
  const SmartGrossAfterAnnual = SmartSavingsAnnual; // ✅ Only the incremental savings

  // Totals for display (gross)
  const totalPlantGross = PlantGrossAnnual * L;
  const totalSmartSavings = SmartSavingsAnnual * L;

  /* ---------- 4. O&M and NET FLOWS ---------- */
  const OandMplant = PlantGrossAnnual * 0.4;  // 40% for new plant
  const OandMsmart = SmartGrossAfterAnnual * 0.2; // 20% for smart grid

  const NetPlantAnnual = PlantGrossAnnual - OandMplant;
  const NetSmartAnnual = SmartGrossAfterAnnual - OandMsmart;

  /* ---------- 5. NPV & ROI (NET) ---------- */
  let NPVplant = -Cplant;
  let NPVsmart = -Csmart;
  let totalPlantNet = 0;
  let totalSmartNet = 0;

  for (let t = 1; t <= L; t++) {
    NPVplant += NetPlantAnnual / Math.pow(1 + r, t);
    NPVsmart += NetSmartAnnual / Math.pow(1 + r, t);
    totalPlantNet += NetPlantAnnual;
    totalSmartNet += NetSmartAnnual;
  }

  const ROIplant = ((totalPlantNet - Cplant) / (Cplant || 1)) * 100;
  const ROIsmart = ((totalSmartNet - Csmart) / (Csmart || 1)) * 100;

  const formattingOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  /* ---------- 6. Projection Table ---------- */
  function projectionAt(years) {
    let npvP = -Cplant, npvS = -Csmart;
    let cumNetP = 0, cumNetS = 0;
    for (let t = 1; t <= years; t++) {
      npvP += NetPlantAnnual / Math.pow(1 + r, t);
      npvS += NetSmartAnnual / Math.pow(1 + r, t);
      cumNetP += NetPlantAnnual;
      cumNetS += NetSmartAnnual;
    }
    const roiP = ((cumNetP - Cplant) / (Cplant || 1)) * 100;
    const roiS = ((cumNetS - Csmart) / (Csmart || 1)) * 100;
    return { roiP, roiS, npvP, npvS };
  }

  const projectionYears = [5, 10, 20];
  let projectionsHtml = `<table style="width:100%;border-collapse:collapse;text-align:center;">
    <tr style="background:#eee;font-weight:bold;">
      <td>Years</td>
      <td>Net ROI (Plant)</td>
      <td>Net ROI (Smart Grid)</td>
      <td>Net NPV (Plant)</td>
      <td>Net NPV (Smart Grid)</td>
    </tr>`;

  projectionYears.forEach((yrs) => {
    if (yrs <= L) {
      const { roiP, roiS, npvP, npvS } = projectionAt(yrs);
      projectionsHtml += `
        <tr>
          <td>${yrs}</td>
          <td>${roiP.toLocaleString(undefined, formattingOptions)}%</td>
          <td>${roiS.toLocaleString(undefined, formattingOptions)}%</td>
          <td>$${npvP.toLocaleString(undefined, formattingOptions)}</td>
          <td>$${npvS.toLocaleString(undefined, formattingOptions)}</td>
        </tr>`;
    }
  });
  projectionsHtml += "</table>";
  document.getElementById("projectionOutput").innerHTML = projectionsHtml;

  /* ---------- 7. Time Series for Charts ---------- */
  let npvPlantOverTime = [], npvSmartOverTime = [];
  let roiPlantOverTime = [], roiSmartOverTime = [];
  let npvP_t = -Cplant, npvS_t = -Csmart;
  let cumNetPlant = 0, cumNetSmart = 0;

  for (let t = 1; t <= L; t++) {
    const disc = Math.pow(1 + r, t);
    npvP_t += NetPlantAnnual / disc;
    npvS_t += NetSmartAnnual / disc;
    cumNetPlant += NetPlantAnnual;
    cumNetSmart += NetSmartAnnual;
    npvPlantOverTime.push(npvP_t);
    npvSmartOverTime.push(npvS_t);
    roiPlantOverTime.push(((cumNetPlant - Cplant) / (Cplant || 1)) * 100);
    roiSmartOverTime.push(((cumNetSmart - Csmart) / (Csmart || 1)) * 100);
  }

  /* ---------- 8. Charts ---------- */
  if (window.npvChart instanceof Chart) window.npvChart.destroy();
  if (window.roiChart instanceof Chart) window.roiChart.destroy();

  const npvCanvas = document.getElementById("npvChart");
  const roiCanvas = document.getElementById("roiChart");
  const ctx1 = npvCanvas.getContext("2d");
  const ctx2 = roiCanvas.getContext("2d");

  window.npvChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels: Array.from({ length: L }, (_, i) => `Year ${i + 1}`),
      datasets: [
        { label: "Net NPV – Smart Grid", data: npvSmartOverTime, borderColor: "green", fill: false },
        { label: "Net NPV – Power Plant", data: npvPlantOverTime, borderColor: "orange", fill: false },
      ],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Net Present Value (after O&M) Over Time" } },
      scales: { y: { title: { display: true, text: "NPV ($)" }, beginAtZero: true } },
    },
  });

  const yMin = Math.min(...roiPlantOverTime, ...roiSmartOverTime);
  const yMax = Math.max(...roiPlantOverTime, ...roiSmartOverTime);
  const pad = (yMax - yMin) * 0.1 || 10;

  window.roiChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels: Array.from({ length: L }, (_, i) => `Year ${i + 1}`),
      datasets: [
        { label: "Net ROI – Smart Grid", data: roiSmartOverTime, borderColor: "blue", fill: false, tension: 0.1 },
        { label: "Net ROI – Power Plant", data: roiPlantOverTime, borderColor: "red", fill: false, tension: 0.1 },
      ],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Return on Investment (after O&M) Over Time" } },
      scales: {
        y: { type: "linear", title: { display: true, text: "Net ROI (%)" }, min: yMin - pad, max: yMax + pad },
        x: { title: { display: true, text: "Years" } },
      },
    },
  });

  /* ---------- 9. Display Results ---------- */
  const fmt = (n) => n.toLocaleString(undefined, formattingOptions);

  document.getElementById("NewPlantResult").textContent = `$${fmt(Cplant)}`;
  document.getElementById("UpgradePlantResult").textContent = `$${fmt(Csmart)}`;
  document.getElementById("NewPlantRevenueResult").textContent = `$${fmt(totalPlantGross)}`;
  document.getElementById("AnnualSavingsResult").textContent = `$${fmt(totalSmartSavings)}`;
  document.getElementById("roiOutput").textContent = `Plant (Net): ${fmt(ROIplant)} % | Smart Grid (Net): ${fmt(ROIsmart)} %`;
  document.getElementById("npvOutput").textContent = `Plant (Net): $${fmt(NPVplant)} | Smart Grid (Net): $${fmt(NPVsmart)}`;

  /* ---------- 10. AI Report ---------- */
  generateReport({
    Cplant,
    Csmart,
    Rplant: totalPlantNet,
    revenuesmart: totalSmartNet,
    ROIplant,
    ROIsmart,
    NPVplant,
    NPVsmart
  });
}

/* ---------- CLEAR FORM ---------- */
function clearForm() {
  document.querySelectorAll("input[type='number']").forEach(el => el.value = "");
  document.getElementById("useCustomCost").checked = false;
  document.getElementById("customCostContainer").style.display = "none";
  document.getElementById("defaultCostContainer").style.display = "block";
  document.querySelectorAll("output").forEach(el => el.textContent = "--");
  document.getElementById("decisionText").textContent = "Decision summary will appear here based on ROI and NPV results.";
  document.getElementById("downloadDecisionPdf").style.display = "none";
}
