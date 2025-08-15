import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";

// Load environment variables; ensure package.json has "type": "module"
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware for JSON parsing and CORS
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Serve front-end assets
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/report
 * Expects { metrics: { Cplant, Csmart, Rplant, revenuesmart, ROIplant, ROIsmart, NPVplant, NPVsmart[, decision] } }
 * Returns JSON { report }
 */
app.post("/api/report", async (req, res) => {
  try {
    const m = req.body.metrics;
    if (!m) {
      return res.status(400).json({ error: "Missing metrics in request body" });
    }

    // Compute decision if not provided
    let decision = m.decision;
    if (!decision) {
      decision = (m.NPVsmart > m.NPVplant && m.ROIsmart > m.ROIplant)
        ? "✅ Upgrade to a Smart Grid is the better choice (higher ROI & NPV)."
        : "⚠️ Building a new plant is financially preferable with current inputs.";
    }

    // Build prompt
content: `
<div class="report-container">
  <div class="report-title">Investment Report: Electricity Grid Analysis</div>

  <section class="section">
    <h3>1. Executive Summary</h3>
    <p>Write a short paragraph summarizing the investment case and final recommendation.</p>
  </section>

  <section class="section">
    <h3>2. Financial Analysis</h3>

    <h4>2.1 Investment Metrics</h4>
    <ul>
      <li><strong>New Plant CapEx:</strong> $${m.Cplant.toLocaleString()}</li>
      <li><strong>Smart Grid CapEx:</strong> $${m.Csmart.toLocaleString()}</li>
      <li><strong>Annual Revenue (Plant):</strong> $${m.Rplant.toLocaleString()}</li>
      <li><strong>Annual Revenue (Smart Grid):</strong> $${m.revenuesmart.toLocaleString()}</li>
      <li><strong>ROI (Plant):</strong> ${m.ROIplant.toFixed(2)}%</li>
      <li><strong>ROI (Smart Grid):</strong> ${m.ROIsmart.toFixed(2)}%</li>
      <li><strong>NPV (Plant):</strong> $${m.NPVplant.toFixed(2)}</li>
      <li><strong>NPV (Smart Grid):</strong> $${m.NPVsmart.toFixed(2)}</li>
    </ul>

    <h4>2.2 Interpretation</h4>
    <p>Explain what the ROI and NPV values imply in terms of financial feasibility.</p>
  </section>

  <section class="section">
    <h3>3. Recommendation</h3>
    <p><strong>${decision}</strong> Justify this based on current values and trends.</p>
  </section>

  <section class="section">
    <h3>4. Strategic Considerations</h3>
    <p>Mention key factors like infrastructure, political climate, funding options, or capacity.</p>
  </section>
</div>
`



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

// Start server
app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
  console.log("Serve your front-end by navigating to http://localhost:3000/index.html");
});
