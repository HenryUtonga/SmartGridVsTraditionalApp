import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/report", async (req, res) => {
  try {
    const m = req.body.metrics;
    if (!m) return res.status(400).json({ error: "Missing metrics in request body" });

    const systemMessage = {
      role: "system",
      content:
        "You are an expert financial analyst writing investment reports in HTML format. Write concise, insight-driven paragraphs interpreting metrics and giving professional recommendations. Do not use markdown; only HTML with inline CSS."
    };

    const userMessage = {
      role: "user",
      content: `
You are an expert energy investment analyst. Generate a professional HTML report (no markdown).  
Keep layout compact with minimal blank space and consistent flow — it must look clean both in browser and when converted to PDF.

**Styling requirements:**
- Global font: Segoe UI, Helvetica, Arial, sans-serif
- Font size: 13px; line-height: 1.45
- Compact margins (no large gaps)
- Headings: small top/bottom margin, thin underline
- Tables: small padding, no wide spacing
- Page must flow continuously — no forced breaks or over-padding

Use these values:
- New Plant CapEx: $${m.Cplant.toLocaleString()}
- Smart Grid CapEx: $${m.Csmart.toLocaleString()}
- Annual Revenue (Plant): $${m.Rplant.toLocaleString()}
- Annual Revenue (Smart Grid): $${m.revenuesmart.toLocaleString()}
- ROI (Plant): ${m.ROIplant.toFixed(2)}%
- ROI (Smart Grid): ${m.ROIsmart.toFixed(2)}%
- NPV (Plant): $${m.NPVplant.toFixed(2)}
- NPV (Smart Grid): $${m.NPVsmart.toFixed(2)}

⚠️ Return ONLY HTML using <div>, <h3>, <h4>, <p>, <table>, <tr>, <td>. No markdown, no explanations.

<div style="max-width:800px;margin:auto;font-family:Segoe UI,Helvetica,Arial,sans-serif;
background:#fff;padding:12px 16px;border-radius:6px;
box-shadow:0 0 6px rgba(0,0,0,0.05);font-size:13px;line-height:1.45;">

  <div style="background:#d0f0c0;text-align:center;
  padding:10px;border-radius:6px;font-size:18px;font-weight:600;">
    INVESTMENT REPORT: SMART GRID vs NEW POWER PLANT
  </div>

  <h3 style="color:#1e3a8a;border-bottom:1px solid #ccc;
  padding-bottom:2px;margin:6px 0 4px 0;">1. Executive Summary</h3>
  <p style="margin:2px 0 4px 0;">[Provide a concise 4–5 sentence executive summary interpreting overall performance and implications.]</p>

  <h3 style="color:#1e3a8a;border-bottom:1px solid #ccc;
  padding-bottom:2px;margin:6px 0 4px 0;">2. Financial Analysis</h3>

  <h4 style="margin:3px 0;color:#2c3e50;">2.1 Investment Metrics</h4>
  <table style="width:100%;border-collapse:collapse;margin:3px 0;">
    <tr style="background:#f2f2f2;">
      <th style="padding:5px;border:1px solid #ccc;text-align:left;">Metric</th>
      <th style="padding:5px;border:1px solid #ccc;text-align:left;">New Power Plant</th>
      <th style="padding:5px;border:1px solid #ccc;text-align:left;">Smart Grid</th>
    </tr>
    <tr>
      <td style="padding:5px;border:1px solid #ccc;">Capital Expenditure (CapEx)</td>
      <td style="padding:5px;border:1px solid #ccc;">$${m.Cplant.toLocaleString()}</td>
      <td style="padding:5px;border:1px solid #ccc;">$${m.Csmart.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:5px;border:1px solid #ccc;">Annual Revenue</td>
      <td style="padding:5px;border:1px solid #ccc;">$${m.Rplant.toLocaleString()}</td>
      <td style="padding:5px;border:1px solid #ccc;">$${m.revenuesmart.toLocaleString()}</td>
    </tr>
    <tr>
      <td style="padding:5px;border:1px solid #ccc;">Return on Investment (ROI)</td>
      <td style="padding:5px;border:1px solid #ccc;">${m.ROIplant.toFixed(2)}%</td>
      <td style="padding:5px;border:1px solid #ccc;">${m.ROIsmart.toFixed(2)}%</td>
    </tr>
    <tr>
      <td style="padding:5px;border:1px solid #ccc;">Net Present Value (NPV)</td>
      <td style="padding:5px;border:1px solid #ccc;">$${m.NPVplant.toFixed(2)}</td>
      <td style="padding:5px;border:1px solid #ccc;">$${m.NPVsmart.toFixed(2)}</td>
    </tr>
  </table>

  <h4 style="margin:4px 0;color:#2c3e50;">2.2 Interpretation</h4>
  <p style="margin:2px 0 4px 0;">[Interpret ROI and NPV briefly (4–6 sentences) — discuss feasibility, efficiency, and comparative performance.]</p>

  <h3 style="color:#1e3a8a;border-bottom:1px solid #ccc;
  padding-bottom:2px;margin:6px 0 4px 0;">3. Recommendation</h3>
  <p style="margin:2px 0 4px 0;">[Write a clear recommendation paragraph comparing both options using the provided metrics. Choose one option and justify it in 4–6 sentences.]</p>

  <h3 style="color:#1e3a8a;border-bottom:1px solid #ccc;
  padding-bottom:2px;margin:6px 0 4px 0;">4. Strategic Considerations</h3>
  <p style="margin:2px 0 4px 0;">[Add 3–4 sentences discussing infrastructure readiness, policy, funding, and long-term sustainability.]</p>
</div>
`
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [systemMessage, userMessage],
      temperature: 0.7,
      max_tokens: 2000
    });

    const report = completion.choices[0].message.content;
    res.json({ report });
  } catch (err) {
    console.error("Error in /api/report:", err);
    res.status(500).json({ error: "Report generation failed" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
