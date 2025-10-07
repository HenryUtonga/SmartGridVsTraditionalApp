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

// ─── Download decision report as multi-page PDF ──────────────
async function downloadDecisionPdf() {
  const el = document.getElementById("decisionText");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Split on <h3> to make one page per major section
  const sections = el.innerHTML.split(/<h3[^>]*>/).filter(Boolean);

  for (let i = 0; i < sections.length; i++) {
    const htmlChunk = "<h3>" + sections[i];
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlChunk;
    tempDiv.style.padding = "20px";
    tempDiv.style.background = "white";
    tempDiv.style.width = "800px";
    tempDiv.style.margin = "auto";
    document.body.appendChild(tempDiv);

    const canvas = await html2canvas(tempDiv, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(imgData);
    const pageHeight = (imgProps.height * pageWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
    if (i < sections.length - 1) pdf.addPage();

    tempDiv.remove();
  }

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

  // Basic sanity: if no lifespan or tariff/hours, we can't compute
  if (L <= 0) {
    alert("Please enter a project lifespan (years) greater than 0.");
    return;
  }

  /* ---------- 2. COSTS ---------- */
  const Cplant = Pnew * Ctype * Region;
  const Csmart = Cinfra + ((Nmeters * Cmeters) / UsersPerMeter);

  /* ---------- 3. GROSS FLOWS ---------- */
  const Pnew_kW = Pnew * 1000;
  const cprod_kW = cprod * 1000;

  const PlantGrossAnnual = Pnew_kW * H * Ttariff * 365;                    // new plant gross $/yr
  const SmartBaseAnnual  = cprod_kW * H * Ttariff * 365;                    // existing system gross $/yr
  const SmartSavingsAnnual = SmartBaseAnnual * (Ssavings / 100);            // $/yr saved by efficiency
  const SmartGrossAfterAnnual = SmartBaseAnnual + SmartSavingsAnnual;       // total effective gross after upgrade

  // Totals (gross) for display
  let totalPlantGross = PlantGrossAnnual * L;
  let totalSmartGrossAfter = SmartGrossAfterAnnual * L;
  let totalSmartSavings = SmartSavingsAnnual * L;

  /* ---------- 4. O&M (ASSUMPTIONS) & NET FLOWS ---------- */
  const OandMplant = PlantGrossAnnual * 0.40;        // 40% O&M for plant
  const OandMsmart = SmartGrossAfterAnnual * 0.20;   // 20% O&M for smart grid

  const NetPlantAnnual = PlantGrossAnnual - OandMplant;
  const NetSmartAnnual = SmartGrossAfterAnnual - OandMsmart;

  /* ---------- 5. NPV & ROI USING NET FLOWS ---------- */
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

  // ROI based on cumulative net profit over project life
  const ROIplant = ((totalPlantNet - Cplant) / (Cplant || 1)) * 100;
  const ROIsmart = ((totalSmartNet - Csmart) / (Csmart || 1)) * 100;

  // Define formatting options for consistency
  const formattingOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  /* ---------- 6. Projection helper (NET) ---------- */
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

  /* ---------- 7. Long-term projections table (NET) ---------- */
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

  /* ---------- 8. Time series for charts (NET) ---------- */
  let npvPlantOverTime = [];
  let npvSmartOverTime = [];
  let roiPlantOverTime = [];
  let roiSmartOverTime = [];

  let npvP_t = -Cplant;
  let npvS_t = -Csmart;
  let cumNetPlant = 0;
  let cumNetSmart = 0;

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

  /* ---------- 9. Charts ---------- */

  // Destroy old charts safely
  if (window.npvChart instanceof Chart) window.npvChart.destroy();
  if (window.roiChart instanceof Chart) window.roiChart.destroy();

  // Safely get canvases
  const npvCanvas = document.getElementById("npvChart");
  const roiCanvas = document.getElementById("roiChart");
  if (!npvCanvas || !roiCanvas) {
    console.error("Canvas elements not found. Check your HTML IDs (npvChart, roiChart).");
    return;
  }
  const ctx1 = npvCanvas.getContext("2d");
  const ctx2 = roiCanvas.getContext("2d");

  // === Chart 1: NPV (NET) ===
  window.npvChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels: Array.from({ length: L }, (_, i) => `Year ${i + 1}`),
      datasets: [
        { label: "Net NPV – Smart Grid", data: npvSmartOverTime, borderColor: "green", fill: false, tension: 0.1 },
        { label: "Net NPV – Power Plant", data: npvPlantOverTime, borderColor: "orange", fill: false, tension: 0.1 },
      ],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Net Present Value (after O&M) Over Time" } },
      scales: { y: { title: { display: true, text: "NPV ($)" }, beginAtZero: true } },
    },
  });

  // === Chart 2: ROI (NET, single axis) ===
  const yMin = Math.min(...roiPlantOverTime, ...roiSmartOverTime);
  const yMax = Math.max(...roiPlantOverTime, ...roiSmartOverTime);
  const pad = (yMax - yMin) * 0.1 || 10;

  window.roiChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels: Array.from({ length: L }, (_, i) => `Year ${i + 1}`),
      datasets: [
        { label: "Net ROI – Smart Grid", data: roiSmartOverTime, borderColor: "blue", borderDash: [5, 5], fill: false, tension: 0.1, yAxisID: "y" },
        { label: "Net ROI – Power Plant", data: roiPlantOverTime, borderColor: "red", borderDash: [5, 5], fill: false, tension: 0.1, yAxisID: "y" },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "Return on Investment (after O&M) Over Time" },
        legend: { position: "top", labels: { boxWidth: 20, usePointStyle: true } },
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Net ROI (%)" },
          min: yMin - pad,
          max: yMax + pad,
          ticks: { callback: (v) => v + "%" },
          grid: { drawOnChartArea: true },
        },
        x: { title: { display: true, text: "Years" } },
      },
    },
  });

  /* ---------- 10. WRITE RESULTS (Display) ---------- */
  const fmt = (n) => n.toLocaleString(undefined, formattingOptions);

  // CapEx results
  document.getElementById("NewPlantResult").textContent = Cplant ? `$${fmt(Cplant)}` : "--";
  document.getElementById("UpgradePlantResult").textContent = Csmart ? `$${fmt(Csmart)}` : "--";

  // Display gross totals (as your UI labels imply “Total Revenue” and “Savings”)
  document.getElementById("NewPlantRevenueResult").textContent = totalPlantGross ? `$${fmt(totalPlantGross)}` : "--";
  document.getElementById("AnnualSavingsResult").textContent = totalSmartSavings ? `$${fmt(totalSmartSavings)}` : "--";

  // Net ROI / Net NPV summary
  document.getElementById("roiOutput").textContent =
    `Plant (Net): ${fmt(ROIplant)} % | Smart Grid (Net): ${fmt(ROIsmart)} %`;
  document.getElementById("npvOutput").textContent =
    `Plant (Net): $${fmt(NPVplant)} | Smart Grid (Net): $${fmt(NPVsmart)}`;

  /* ---------- 11. Invoke AI report generation ----------
     NOTE: passing NET totals to the report so the narrative matches the charts */
  generateReport({
    Cplant,
    Csmart,
    Rplant: totalPlantNet,          // net totals
    revenuesmart: totalSmartNet,    // net totals
    ROIplant,
    ROIsmart,
    NPVplant,
    NPVsmart
  });
}

/* ---------- CLEAR FORM  ---------- */
function clearForm() {
  document.querySelectorAll("input[type='number']").forEach(el => el.value = "");
  document.getElementById("useCustomCost").checked = false;
  document.getElementById("customCostContainer").style.display = "none";
  document.getElementById("defaultCostContainer").style.display = "block";
  document.getElementById("regionContainer").style.display = "block";
  document.querySelectorAll("output").forEach(el => el.textContent = "--");
  document.getElementById("decisionText").textContent =
    "Decision summary will appear here based on ROI and NPV results.";
  document.getElementById("downloadDecisionPdf").style.display = "none";
}
