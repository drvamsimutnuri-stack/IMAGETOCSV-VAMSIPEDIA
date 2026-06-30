import { TEST_TYPE, mergeExtractedRows, defaultTableRows } from './schema.js';

const EXTRACTION_PROMPT = `You are a medical document data extractor. Extract ONLY the "Body Plethysmography" test results table from this pulmonary function test (PFT) report image.

The table has these columns: Parameter, Unit, Pred, Pre, % Pred, LLN, Z-Score.

Extract exactly these 13 parameters (if present):
1. Raw tot [kPa*s/L]
2. sRaw tot [kPa*s]
3. Gaw tot [L/s/kPa]
4. TGV [L]
5. ERV [L]
6. RV [L]
7. TLC [L]
8. RV%TLC [%]
9. TGV%TLC [%]
10. FEV 1 [L]
11. VC MAX [L]
12. VT [L]
13. FRC [L]

Rules:
- If the report contains multiple test sections, extract ONLY the Body Plethysmography table.
- Missing LLN or Z-Score values should be null (shown as dash in report).
- Strip % signs from pct_pred values (store as number only, e.g. 64 not "64%").
- Z-Score is the numeric value only (ignore color bars).
- Return valid JSON matching this schema exactly:

{
  "test_type": "Body Plethysmography",
  "found": true,
  "rows": [
    {
      "parameter": "TGV",
      "unit": "L",
      "pred": 3.32,
      "pre": 2.33,
      "pct_pred": 70,
      "lln": 2.34,
      "z_score": -1.6
    }
  ]
}

If no Body Plethysmography table is found, return:
{"test_type": "Body Plethysmography", "found": false, "rows": []}`;

/**
 * Call Gemini Vision API to extract Body Plethysmography table.
 * @param {string} apiKey
 * @param {string} model
 * @param {string} base64Image - raw base64 without data URL prefix
 * @param {string} mimeType
 * @returns {Promise<{ rows: object[], found: boolean, raw?: string }>}
 */
export async function extractBodyPlethysmography(apiKey, model, base64Image, mimeType) {
  if (!apiKey?.trim()) {
    throw new Error('Gemini API key is required. Add your key in Settings.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const body = {
    contents: [
      {
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    let message = `Gemini API error (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      message = errJson.error?.message || message;
    } catch {
      if (errText) message += `: ${errText.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ??
    '';

  if (!text) {
    throw new Error('Empty response from Gemini. The model may have blocked the content.');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try to salvage JSON from markdown fences
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse JSON from Gemini response.');
    }
  }

  if (!parsed.found || !parsed.rows?.length) {
    return {
      found: false,
      rows: defaultTableRows(),
      raw: text,
    };
  }

  return {
    found: true,
    rows: mergeExtractedRows(parsed.rows),
    raw: text,
  };
}

export { TEST_TYPE };
