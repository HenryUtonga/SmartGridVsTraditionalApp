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
      content: "You are an expert financial analyst writing investment reports in HTML format. You must provide insightful, well-structured paragraphs interpreting financial metrics and making reasoned investment recommendations. Do not use markdown, only HTML. Use professional language."
    };

   const userMessage = {
  role: "user",
  content: `
You are an expert energy investment analyst. Generate a clean HTML report **without using markdown**. Style the report **visually using inline CSS** (no external CSS needed). Format metrics in a **two-column HTML table** under Section 2.1.

Use these values:
- New Plant CapEx: $${m.Cplant.toLocaleString()}
- Smart Grid CapEx: $${m.Csmart.toLocaleString()}
- Annual Revenue (Plant): $${m.Rplant.toLocaleString()}
- Annual Revenue (Smart Grid): $${m.revenuesmart.toLocaleString()}
- ROI (Plant): ${m.ROIplant.toFixed(2)}%
- ROI (Smart Grid): ${m.ROIsmart.toFixed(2)}%
- NPV (Plant): $${m.NPVplant.toFixed(2)}
- NPV (Smart Grid): $${m.NPVsmart.toFixed(2)}


⚠️ Return ONLY HTML using <div>, <h3>, <h4>, <p>, <table>, <tr>, <td>, No markdown. No explanations.

Here is the required structure:

<div style="max-width:800px;margin:auto;font-family:Segoe UI,Helvetica,sans-serif;background:#fff;padding:30px;border-radius:8px;box-shadow:0 0 12px rgba(0,0,0,0.05)">
  <div style="background:#d0f0c0;text-align:center;padding:16px;border-radius:6px;font-size:24px;font-weight:bold;">
    INVESTIMENT REPORT: SMART GRID vs NEW POWER PLANT ANALYSIS REPORT
  </div>

  <h3 style="color:#1e3a8a;border-bottom:2px solid #e0e0e0;padding-bottom:6px;">1. Executive Summary</h3>
<p>Based on your interpretation above, provide a clear and well-reasoned Executive Summary with 4–5 full sentences.</p>

  <h3 style="color:#1e3a8a;border-bottom:2px solid #e0e0e0;padding-bottom:6px;">2. Financial Analysis</h3>

  <h4 style="margin-top:20px;color:#2c3e50;">2.1 Investment Metrics</h4>
  <table style="width:100%;border-collapse:collapse;margin-top:10px;">
    <tr><td style="padding:8px;border:1px solid #ccc;">New Plant CapEx</td><td style="padding:8px;border:1px solid #ccc;">$${m.Cplant.toLocaleString()}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ccc;">Smart Grid CapEx</td><td style="padding:8px;border:1px solid #ccc;">$${m.Csmart.toLocaleString()}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ccc;">Annual Revenue (Plant)</td><td style="padding:8px;border:1px solid #ccc;">$${m.Rplant.toLocaleString()}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ccc;">Annual Revenue (Smart Grid)</td><td style="padding:8px;border:1px solid #ccc;">$${m.revenuesmart.toLocaleString()}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ccc;">ROI (Plant)</td><td style="padding:8px;border:1px solid #ccc;">${m.ROIplant.toFixed(2)}%</td></tr>
    <tr><td style="padding:8px;border:1px solid #ccc;">ROI (Smart Grid)</td><td style="padding:8px;border:1px solid #ccc;">${m.ROIsmart.toFixed(2)}%</td></tr>
    <tr><td style="padding:8px;border:1px solid #ccc;">NPV (Plant)</td><td style="padding:8px;border:1px solid #ccc;">$${m.NPVplant.toFixed(2)}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ccc;">NPV (Smart Grid)</td><td style="padding:8px;border:1px solid #ccc;">$${m.NPVsmart.toFixed(2)}</td></tr>
  </table>

  <h4 style="margin-top:20px;color:#2c3e50;">2.2 Interpretation</h4>
   <p>Interpret the ROI and NPV values in your own words, highlighting financial feasibility, strengths, and weaknesses of both options. Use at least 4–6 sentences.</p>

  <h3 style="color:#1e3a8a;border-bottom:2px solid #e0e0e0;padding-bottom:6px;">3. Recommendation</h3>
  <p>Write here your recommendation paragraph clealy advising whrther upgrading the grid is more cost effecing than building a new power plant using at least 4–5 sentences and justify it with the metrics above.</p>

  <h3 style="color:#1e3a8a;border-bottom:2px solid #e0e0e0;padding-bottom:6px;">4. Strategic Considerations</h3>
  <p>Discuss other important factors like infrastructure, energy policy, funding access, and long-term resilience in 3–4 sentences.</p> 

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
