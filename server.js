const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Server test
app.get("/", (req, res) => {
  res.send("BL AI Server is running!");
});

// Small delay for retry
const wait = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Gemini Chat API
app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message required"
      });
    }

    const model = "gemini-3.5-flash-lite";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
      encodeURIComponent(apiKey);

    let data;
    let lastError;
    let success = false;

    // Maximum 3 attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            contents: [{
              parts: [{ text: message }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512
            }
          })
        });

        data = await response.json();

        if (response.ok) {
          success = true;
          break;
        }

        lastError =
          data.error?.message || "Gemini API error";

        // Retry only temporary errors
        if (![429, 500, 502, 503, 504].includes(response.status)) {
          return res.status(response.status).json({
            error: lastError
          });
        }

      } catch (error) {
        lastError = error.message;
      }

      if (attempt < 2) {
        await wait(500 * (attempt + 1));
      }
    }

    if (!success) {
      console.error("Gemini failed:", lastError);

      return res.status(503).json({
        error: lastError || "Gemini temporarily unavailable"
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "जवाब नहीं मिला।";

    return res.json({ reply });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("BL AI Fast Gemini Server started on port " + PORT);
});
