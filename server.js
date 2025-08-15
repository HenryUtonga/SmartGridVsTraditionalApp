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

    const decision =
      m.decision ||
      (m.NPVsmart > m.NPVplant && m.ROIsmart > m.ROIplant
        ? "✅ Upgrade to a Smart Grid is the better choice (higher ROI & NPV)."
        : "⚠️ Building a new plant is financially preferable with current inputs.");

    const systemMessage = {
      role: "system",
      content: "You are a professional analyst who returns clean inline-styled HTML investment reports. Do not return markdown or explanations."
    };

    const userMessage = {
      role: "user",
      content: `
Generate a styled HTML report using only <div>, <h3>, <h4>, <p>, <table>, <tr>, <td>, <strong> tags. Use inline CSS for layout and styling. No markdown. Here's the data:

- New Plant CapEx: $${m.Cplant.toLocaleString()}
- Smart Grid CapEx: $${m.Csmart.toLocaleString()}
- Annual Revenue (Plant): $${m.Rplant.toLocaleString()}
- Annual Revenue (Smart Grid): $${m.revenuesmart.toLocaleString()}
- ROI (Plant): ${m.ROIplant.toFixed(2)}%
- ROI (Smart Grid): ${m.ROIsmart.toFixed(2)}%
- NPV (Plant): $${m.NPVplant.toFixed(2)}
- NPV (Smart Grid): $${m.NPVsmart.toFixed(2)}
- Recommendation: ${decision}

The report must follow this structure:

<div style="font-family:Segoe UI,Helvetica,sans-serif; background:#f9f9f9; padding:30px; color:#333;">
  <div style="background:#d0f0c0; font-size:24px; font-weight:bold; text-align:center; padding:16px; border-radius:6px; margin-bottom:30px;">
    Investment Report: Electricity Grid Analysis
  </div>

  <div style="margin-bottom:36px;">
    <h3 style="color:#0b3d91; border-bottom:2px solid #ccc;">1. Executive Summary</h3>
    <p>Write a short paragraph summarizing the investment case and final recommendation.</p>
  </div>

  <div style="margin-bottom:36px;">
    <h3 style="color:#0b3d91; border-bottom:2px solid #ccc;">2. Financial Analysis</h3>
    <h4 style="color:#333;">2.1 Investment Metrics</h4>
    <table style="width:100%; border-collapse:collapse;">
      <tr><td><strong>New Plant CapEx:</strong></td><td>$${m.Cplant.toLocaleString()}</td></tr>
      <tr><td><strong>Smart Grid CapEx:</strong></td><td>$${m.Csmart.toLocaleString()}</td></tr>
      <tr><td><strong>Annual Revenue (Plant):</strong></td><td>$${m.Rplant.toLocaleString()}</td></tr>
      <tr><td><strong>Annual Revenue (Smart Grid):</strong></td><td>$${m.revenuesmart.toLocaleString()}</td></tr>
      <tr><td><strong>ROI (Plant):</strong></td><td>${m.ROIplant.toFixed(2)}%</td></tr>
      <tr><td><strong>ROI (Smart Grid):</strong></td><td>${m.ROIsmart.toFixed(2)}%</td></tr>
      <tr><td><strong>NPV (Plant):</strong></td><td>$${m.NPVplant.toFixed(2)}</td></tr>
      <tr><td><strong>NPV (Smart Grid):</strong></td><td>$${m.NPVsmart.toFixed(2)}</td></tr>
    </table>

    <h4 style="color:#333; margin-top:20px;">2.2 Interpretation</h4>
    <p>Explain what the ROI and NPV values imply in terms of financial feasibility.</p>
  </div>

  <div style="margin-bottom:36px;">
    <h3 style="color:#0b3d91; border-bottom:2px solid #ccc;">3. Recommendation</h3>
    <p><strong>${decision}</strong> Justify this based on current values and trends.</p>
  </div>

  <div style="margin-bottom:36px;">
    <h3 style="color:#0b3d91; border-bottom:2px solid #ccc;">4. Strategic Considerations</h3>
    <p>Mention key factors like infrastructure, political climate, funding options, or capacity.</p>
  </div>
</div>
`
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [systemMessage, userMessage],
      temperature: 0.7,
      max_tokens: 1000
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
