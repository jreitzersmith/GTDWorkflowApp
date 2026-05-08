// Web search tool (Tavily) — used by AI coach in Chat mode.
// Pure async function — no React dependencies.

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
  if (!res.ok) throw new Error(`Tavily error: ${data.error || res.status}`);
  const results = (data.results || []).map((r, i) =>
    `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`
  ).join("\n\n");
  return data.answer ? `Summary: ${data.answer}\n\nSources:\n${results}` : results;
}

export { TOOLS, doWebSearch };
