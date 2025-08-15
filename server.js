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
    if (!m) {
      return res.status(400).json({ error: "Missing metrics in request body" });
    }

    // Decision logic
    let decision = m.decision;
    const isSmartBetter = m.NPVsmart > m.NPVplant && m.ROIsmart > m.ROIplant;
    if (!decision) {
      decision = isSmartBetter
        ? "✅ Upgrade to a Smart Grid is the better choice (higher ROI & NPV)."
        : "⚠️ Building a new plant is financially preferable with current inputs.";
    }

    const interpretationText = isSmartBetter
      ? "The smart grid shows a stronger financial profile with a higher ROI and NPV. This indicates greater long-term value despite potentially higher initial costs. The traditional plant is less attractive financially under current conditions."
      : "The new plant shows a stronger financial profile with a higher ROI and NPV. This suggests better short- and medium-term returns, making it the more viable financial choice at present.";

    const systemMessage = {
      role: "system",
      content: "You are an expert energy analyst generating investment reports in clean HTML. Return only HTML with no markdown."
    };

    const userMessage = {
      role: "user",
      content: `
<div class="report-container">
  <div class="report-title">Investment Report: Electricity Grid Analysis</div>

  <section class="section">
    <h3>1. Executive Summary</h3>
    <p>Write a concise paragraph summarizing the investment decision.</p>
  </section>

  <section class="section">
    <h3>2. Financial Analysis</h3>

    <h4>2.1 Investment Metrics</h4>
    <table>
      <tr><td><strong>New Plant CapEx</strong></td><td>$${m.Cplant.toLocaleString()}</td></tr>
      <tr><td><strong>Smart Grid CapEx</strong></td><td>$${m.Csmart.toLocaleString()}</td></tr>
      <tr><td><strong>Annual Revenue (Plant)</strong></td><td>$${m.Rplant.toLocaleString()}</td></tr>
      <tr><td><strong>Annual Revenue (Smart Grid)</strong></td><td>$${m.revenuesmart.toLocaleString()}</td></tr>
      <tr><td><strong>ROI (Plant)</strong></td><td>${m.ROIplant.toFixed(2)}%</td></tr>
      <tr><td><strong>ROI (Smart Grid)</strong></td><td>${m.ROIsmart.toFixed(2)}%</td></tr>
      <tr><td><strong>NPV (Plant)</strong></td><td>$${m.NPVplant.toFixed(2)}</td></tr>
      <tr><td><strong>NPV (Smart Grid)</strong></td><td>$${m.NPVsmart.toFixed(2)}</td></tr>
    </table>

    <h4>2.2 Interpretation</h4>
    <p>${interpretationText}</p>
  </section>

  <section class="section">
    <h3>3. Recommendation</h3>
    <p><strong>${decision}</strong> Justify the recommendation with key data points.</p>
  </section>

  <section class="section">
    <h3>4. Strategic Considerations</h3>
    <p>Mention infrastructure readiness, funding, market trends, and political risks briefly.</p>
  </section>
</div>
`
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [systemMessage, userMessage],
      temperature: 0.7,
      max_tokens: 800
    });

    const report = completion.choices[0].message.content;
    return res.json({ report });
  } catch (err) {
    console.error("Error in /api/report:", err);
    return res.status(500).json({ error: "Report generation failed" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});
