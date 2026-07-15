// claudeApi.js — central request-target builder for Claude API calls.
// When VITE_API_BASE_URL is set (production build), routes through the AWS
// edge FastAPI proxy (api.reitzersmith.com), which holds the real Anthropic
// key server-side and authenticates via a shared bearer token. When unset
// (local dev), calls go directly to api.anthropic.com as before.
function claudeRequest(extraHeaders = {}) {
  const proxyBase = import.meta.env.VITE_API_BASE_URL;
  if (proxyBase) {
    return {
      url: `${proxyBase}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_API_BEARER_TOKEN}`,
        ...extraHeaders,
      },
    };
  }
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      ...extraHeaders,
    },
  };
}

export { claudeRequest };
