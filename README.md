# 🛡️ LLM Guardrails Gateway

A middleware layer that sits **between the user and any LLM** and enforces safety, compliance, and output structure rules — without touching a single line of code.

```
User Prompt
    │
    ▼
┌─────────────────┐
│  Input Guard    │  ← Blocks injections, PII, toxic input
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   LLM Adapter   │  ← OpenAI / Anthropic / Mock
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│  Output Guard    │  ← Schema, policy rules, toxic output
└────────┬─────────┘
         │ (violation)
         ▼
┌─────────────────┐
│  Retry / Fix    │  ← Re-prompt with correction instruction
└────────┬────────┘
         │ (still failing)
         ▼
┌─────────────────┐
│  Safe Fallback  │  ← Configured safe message
└─────────────────┘
```

---

## Features

| Guardrail | What it does |
|-----------|-------------|
| **Prompt injection detection** | Blocks jailbreak / instruction override attempts |
| **PII redaction** | Detects & redacts credit cards, SSNs, emails, phones, IPs |
| **Toxic input blocking** | Blocks harmful / dangerous prompts |
| **Max length enforcement** | Prevents oversized inputs |
| **JSON schema validation** | Ensures LLM returns valid structured output |
| **Competitor mention blocking** | Configurable via YAML, no code changes |
| **Medical advice blocking** | Pattern-based, fully configurable |
| **Disallowed phrases** | Any phrase list you define |
| **Required phrases** | Ensures mandatory content appears |
| **Auto-retry with correction** | Re-prompts LLM with violation details |
| **Safe fallback** | Returns a safe message when all retries fail |

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-username/llm-guardrails-gateway.git
cd llm-guardrails-gateway

# 2. Install dependencies
npm install

# 3. (Optional) Set up your API key for a real LLM
cp .env.example .env
# Then edit .env and add your LLM_API_KEY

# 4. Run the demo — works with no API key needed
npm run demo

# 5. Run the full test suite
npm test
```

---

## Use in Your Code

```js
const { Gateway } = require("./src");

// Uses mock LLM by default — no API key needed
const gateway = new Gateway();

// Or use a real LLM provider:
// Set LLM_API_KEY in your .env file or environment, then:
const gateway = new Gateway({
  llmOptions: {
    provider: "openai",               // "openai" | "anthropic" | "mock"
    apiKey:   process.env.LLM_API_KEY,
    model:    "gpt-4o-mini"
  }
});

const result = await gateway.process("What is the capital of France?");
console.log(result.response);
// → "The capital of France is Paris."
```

### Result Object

```js
{
  success:          true,       // false if guardrail blocked or fallback used
  response:         "...",      // final text to return to the user (or fallback)
  usedFallback:     false,      // true if all retries were exhausted
  attempts:         1,          // number of LLM calls made
  inputViolations:  [],         // e.g. [{type: "prompt_injection", message: "..."}]
  inputWarnings:    [],         // e.g. [{type: "pii_redacted",     message: "..."}]
  outputViolations: [],         // e.g. [{type: "competitor_mention", message: "..."}]
  outputWarnings:   [],         // e.g. [{type: "missing_required_phrase", message: "..."}]
  parsed:           null        // parsed JSON object when schema: "json" is set
}
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your key:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | Only for real LLM providers | Your OpenAI or Anthropic API key |

> **Note:** The mock provider (used by default and in all tests) requires no API key at all.

---

## Configure Rules Without Code

Open `config/policy.yaml` — non-engineers can define all rules here. No code changes needed.

```yaml
# Block competitor mentions in LLM responses
rules:
  block_competitor_mentions: true
  competitors:
    - "OpenAI"
    - "Google Gemini"

  # Block medical advice
  block_medical_advice: true

  # Add any custom banned phrases
  disallowed_phrases:
    - "guaranteed returns"
    - "100% safe"

  # Require these phrases in every response
  required_phrases:
    - "consult a professional"

# Auto-retry when a violation is detected
retry:
  enabled: true
  max_attempts: 2
  correction_prompt: "Please revise your response to comply with our content policy."

# Fallback message when all retries fail
fallback:
  message: "I'm sorry, I wasn't able to provide a compliant response. Please rephrase your question."
```

---

## Project Structure

```
llm-guardrails-gateway/
├── .env.example             ← Copy to .env, add your API key
├── .gitignore
├── config/
│   └── policy.yaml          ← All rules live here (edit freely)
├── src/
│   ├── index.js             ← Public API entry point
│   ├── policy/
│   │   └── policy_engine.js ← Loads & evaluates YAML rules
│   ├── guardrails/
│   │   ├── input_guardrail.js   ← Validates incoming prompts
│   │   └── output_guardrail.js  ← Validates LLM responses
│   ├── middleware/
│   │   ├── gateway.js       ← Orchestrates the full pipeline
│   │   └── llm_adapter.js   ← OpenAI / Anthropic / Mock adapter
│   ├── utils/
│   │   └── pii_detector.js  ← PII detection & redaction
│   └── tests/
│       └── run_tests.js     ← 41 tests, no API key needed
└── examples/
    └── demo.js              ← Live walkthrough of all features
```

---

## Supported LLM Providers

| Provider  | `provider` value | Auth |
|-----------|-----------------|------|
| OpenAI    | `"openai"`      | `LLM_API_KEY` env var |
| Anthropic | `"anthropic"`   | `LLM_API_KEY` env var |
| Mock      | `"mock"`        | None — safe for tests & CI |

---

## Running Tests

Tests use the built-in mock provider. No API key, no network calls, no cost.

```bash
npm test
# Expected: 41/41 passed
```

---

## License

MIT
