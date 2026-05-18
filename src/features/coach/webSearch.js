// Web search + URL fetch tools — used by AI coach in Chat mode.
// Pure async functions — no React dependencies.

const TOOLS = [
  {
    name: "web_search",
    description: "Search the web for current information. Use this when the user asks about something that may require up-to-date facts, recent events, current pricing, product comparisons, or any information that benefits from a live search.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query to look up" },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description: "Fetch and read the full content of a specific URL. Use this when the user provides a URL and wants you to read, summarise, or extract information from it — e.g. a webpage, article, documentation page, or any link they reference in the conversation.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to fetch (must start with http:// or https://)" },
      },
      required: ["url"],
    },
  },
];

async function doWebSearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: import.meta.env.VITE_TAVILY_API_KEY,
      query,
      max_results: 5,
      include_answer: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Tavily error: " + (data.error || res.status));
  const results = (data.results || []).map(function(r, i) {
    return "[" + (i + 1) + "] " + r.title + "\n" + r.url + "\n" + r.content;
  }).join("\n\n");
  return data.answer ? "Summary: " + data.answer + "\n\nSources:\n" + results : results;
}

// Fetch a URL via Jina Reader (r.jina.ai), which returns clean readable text
// from any public web page without needing an API key or dealing with raw HTML.
// Content is truncated at 12 000 chars to avoid saturating the context window.
async function doFetchUrl(url) {
  const jinaUrl = "https://r.jina.ai/" + url;
  const res = await fetch(jinaUrl, { headers: { Accept: "text/plain" } });
  if (!res.ok) throw new Error("Could not fetch URL (status " + res.status + "): " + url);
  const text = await res.text();
  const MAX = 12000;
  return text.length > MAX
    ? text.slice(0, MAX) + "\n\n[Content truncated — showing first " + MAX + " characters]"
    : text;
}

export { TOOLS, doWebSearch, doFetchUrl };
