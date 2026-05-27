// receiptUtils.js — AI-powered receipt field extraction from email content.
// extractReceiptFields calls claude-haiku with a structured prompt and returns
// { vendor, amount, currency, date, category, description }.

const RECEIPT_EXTRACTION_PROMPT = [
  'You are a receipt parser. Extract financial details from the provided email content.',
  'Respond with ONLY a JSON object (no markdown fences, no extra text) containing these exact keys:',
  '  vendor      — merchant or sender name (string)',
  '  amount      — numeric total as a string, no currency symbol (e.g. "29.99")',
  '  currency    — ISO 4217 code (e.g. "USD", "EUR") — default "USD" if unknown',
  '  date        — transaction date as YYYY-MM-DD — fall back to the email date if not visible',
  '  category    — best-guess category (e.g. "Shopping", "Food & Drink", "Travel", "Utilities")',
  '  description — brief one-line description of the purchase',
  'Use null for any field you cannot determine.',
].join('\n');

// extractReceiptFields — call Claude haiku to parse financial data from an email.
// emailDetail: { subject, from, date, body, snippet, id }
// apiKey: VITE_ANTHROPIC_API_KEY string
// Returns: { vendor, amount, currency, date, category, description }
async function extractReceiptFields(emailDetail, apiKey) {
  const emailText = [
    `Subject: ${emailDetail.subject || '(no subject)'}`,
    `From: ${emailDetail.from || ''}`,
    `Date: ${emailDetail.date || ''}`,
    '',
    (emailDetail.body || emailDetail.snippet || '').slice(0, 6000),
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: RECEIPT_EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: emailText }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Receipt extraction request failed: ${res.status}${errText ? ' — ' + errText.slice(0, 200) : ''}`);
  }

  const data = await res.json();
  const text = (data.content?.[0]?.text || '').trim();

  // Strip markdown fences if the model wraps the JSON anyway
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI response did not contain a JSON object');

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Could not parse receipt JSON from AI response');
  }
}

export { extractReceiptFields };
