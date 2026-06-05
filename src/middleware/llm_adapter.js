/**
 * LLMAdapter
 * Thin adapter that wraps any LLM provider.
 *
 * Usage:
 *   const adapter = new LLMAdapter({ provider: "mock" });
 *   const text = await adapter.complete(prompt, systemPrompt);
 *
 * Supported providers: "mock", "openai", "anthropic"
 * The "mock" provider is used for testing — no API key required.
 */

class LLMAdapter {
  /**
   * @param {{
   *   provider: "mock"|"openai"|"anthropic",
   *   apiKey?:  string,
   *   model?:   string
   * }} options
   */
  constructor(options = {}) {
    this.provider = options.provider || "mock";
    this.apiKey   = options.apiKey   || process.env.LLM_API_KEY;
    this.model    = options.model;
  }

  /**
   * Send a prompt to the LLM and return the response text.
   * @param {string} prompt
   * @param {string} [systemPrompt]
   * @returns {Promise<string>}
   */
  async complete(prompt, systemPrompt) {
    switch (this.provider) {
      case "mock":
        return this._mockComplete(prompt, systemPrompt);
      case "openai":
        return this._openaiComplete(prompt, systemPrompt);
      case "anthropic":
        return this._anthropicComplete(prompt, systemPrompt);
      default:
        throw new Error(`Unknown LLM provider: "${this.provider}"`);
    }
  }

  // ── Mock provider (no API key needed) ───────────────────────────────────────

  async _mockComplete(prompt, _systemPrompt) {
    // Deterministic mock responses keyed by prompt keywords
    const p = prompt.toLowerCase();

    if (p.includes("weather"))
      return "The weather today is sunny with a high of 75°F. Great day to be outside!";

    if (p.includes("capital of france"))
      return "The capital of France is Paris.";

    if (p.includes("json") || p.includes("schema"))
      return JSON.stringify({ status: "ok", result: "Sample structured response", timestamp: new Date().toISOString() });

    if (p.includes("hello") || p.includes("hi"))
      return "Hello! How can I assist you today?";

    if (p.includes("competitor") || p.includes("openai"))
      return "OpenAI makes great products. You should use GPT-4!";   // intentionally violating for test

    if (p.includes("medical") || p.includes("headache") || p.includes("pain"))
      return "You should take 1000mg of ibuprofen right away and stop taking your medication immediately.";  // intentionally violating

    return `I received your message: "${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}". Here is a helpful response.`;
  }

  // ── OpenAI provider ─────────────────────────────────────────────────────────

  async _openaiComplete(prompt, systemPrompt) {
    if (!this.apiKey) throw new Error("OpenAI API key not set (set LLM_API_KEY env var).");

    const model    = this.model || "gpt-4o-mini";
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const res  = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ model, messages, max_tokens: 1024 })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  // ── Anthropic provider ───────────────────────────────────────────────────────

  async _anthropicComplete(prompt, systemPrompt) {
    if (!this.apiKey) throw new Error("Anthropic API key not set (set LLM_API_KEY env var).");

    const model = this.model || "claude-3-haiku-20240307";
    const body  = {
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.content[0].text;
  }
}

module.exports = LLMAdapter;
