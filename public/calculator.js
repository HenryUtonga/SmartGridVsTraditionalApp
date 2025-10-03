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
  const r = (parseFloat(document.getElementById("Discount").value) || 0) / 100; // Convert discount rate to decimal
  const L = parseFloat(document.getElementById("Lifespan").value) || 0;

  /* ---------- 2. CORRECTED CORE FORMULAS ---------- */
  // Initial Costs (These were correct)
  const Cplant = Pnew * Ctype * Region;
  const Csmart = Cinfra + ((Nmeters * Cmeters) / UsersPerMeter);
  
  // Annual Revenues & Savings (Do NOT multiply by L here)
  const Pnew_kW = Pnew * 1000;
  const cprod_kW = cprod * 1000;
  const RplantAnnual = Pnew_kW * H * Ttariff * 365;
  const SsmartAnnual = cprod_kW * H * Ttariff * 365 * (Ssavings / 100);

  // CORRECT NPV Calculation for the full lifespan 'L'
  let NPVplant = -Cplant;
  let NPVsmart = -Csmart;
  let totalPlantRevenue = 0;
  let totalSmartRevenue = 0;

  for (let t = 1; t <= L; t++) {
    // Use ANNUAL revenue/savings inside the loop
    NPVplant += RplantAnnual / Math.pow(1 + r, t);
    NPVsmart += SsmartAnnual / Math.pow(1 + r, t);
    // Keep track of total undiscounted revenue for ROI calculation
    totalPlantRevenue += RplantAnnual;
    totalSmartRevenue += SsmartAnnual;
  }

  // CORRECT ROI Calculation (based on total profit over total cost)
  const ROIplant = ((totalPlantRevenue - Cplant) / (Cplant || 1)) * 100;
  const ROIsmart = ((totalSmartRevenue - Csmart) / (Csmart || 1)) * 100;

  // ─── 2b. CORRECTED Projected ROI and NPV at 5, 10, 20 years ───
  function calculateNPVandROI(years) {
    let npvPlant = -Cplant;
    let npvSmart = -Csmart;
    let cumulativePlantRevenue = 0;
    let cumulativeSmartRevenue = 0;

    // The loop should only go up to the projection 'years'
    for (let t = 1; t <= years; t++) {
      npvPlant += RplantAnnual / Math.pow(1 + r, t);
      npvSmart += SsmartAnnual / Math.pow(1 + r, t);
      cumulativePlantRevenue += RplantAnnual;
      cumulativeSmartRevenue += SsmartAnnual;
    }
    // Correct ROI for the specific projection period
    const roiPlant = ((cumulativePlantRevenue - Cplant) / (Cplant || 1)) * 100;
    const roiSmart = ((cumulativeSmartRevenue - Csmart) / (Csmart || 1)) * 100;
    
    return { roiPlant, roiSmart, npvPlant, npvSmart };
  }

  const projectionYears = [5, 10, 20];
  let projectionsHtml = `<table style="width:100%;border-collapse:collapse;text-align:center;">
    <tr style="background:#eee;font-weight:bold;">
      <td>Years</td>
      <td>ROI (Plant)</td>
      <td>ROI (Smart Grid)</td>
      <td>NPV (Plant)</td>
      <td>NPV (Smart Grid)</td>
    </tr>`;

  projectionYears.forEach((years) => {
    // Ensure we don't project beyond the project's lifespan
    if (years <= L) {
      const { roiPlant, roiSmart, npvPlant, npvSmart } = calculateNPVandROI(years);
      projectionsHtml += `
        <tr>
          <td>${years}</td>
          <td>${roiPlant.toFixed(2)}%</td>
          <td>${roiSmart.toFixed(2)}%</td>
          <td>$${npvPlant.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          <td>$${npvSmart.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        </tr>`;
    }
  });

  projectionsHtml += "</table>";
  document.getElementById("projectionOutput").innerHTML = projectionsHtml;

  /* ---------- 3. WRITE RESULTS (non-AI) ---------- */
  // NOTE: Displaying total revenue and savings, not annual.
  document.getElementById("NewPlantResult").textContent = Cplant ? `$${Cplant.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("UgradePlantResult").textContent = Csmart ? `$${Csmart.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("NewPlantRevenueResult").textContent = totalPlantRevenue ? `$${totalPlantRevenue.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("AnnualSavingsResult").textContent = totalSmartRevenue ? `$${totalSmartRevenue.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  // The element with id "Smartrevenue" is now misleading, as it shows total savings. 
  // Let's assume you wanted total revenue/savings for the smart grid project here.
  document.getElementById("Smartrevenue").textContent = totalSmartRevenue ? `$${totalSmartRevenue.toLocaleString(undefined,{maximumFractionDigits:2})}` : "--";
  document.getElementById("roiOutput").textContent = `Plant: ${ROIplant.toFixed(2)} % | Smart Grid: ${ROIsmart.toFixed(2)} %`;
  document.getElementById("npvOutput").textContent = `Plant: $${NPVplant.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} | Smart Grid: $${NPVsmart.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  /* ---------- 4. Invoke AI report generation ---------- */
  // Let's pass the total revenues to the AI for clarity
  generateReport({ Cplant, Csmart, Rplant: totalPlantRevenue, revenuesmart: totalSmartRevenue, ROIplant, ROIsmart, NPVplant, NPVsmart });
}

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
