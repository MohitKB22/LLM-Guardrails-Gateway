# 🛡️ LLM Guardrails Gateway

A configurable middleware layer that sits between users and LLMs to enforce safety, compliance, and output quality rules.

Instead of hardcoding checks into application logic, policies are defined in YAML and applied automatically to every request and response.

## Why Use It?

* Block prompt injection and jailbreak attempts
* Detect and redact PII
* Filter toxic or unsafe content
* Enforce structured JSON responses
* Apply business-specific policies without code changes
* Automatically retry and correct non-compliant outputs
* Return safe fallback responses when validation fails

## Supported Providers

* OpenAI
* Anthropic
* Mock provider (for testing and CI)

Using a real provider:

```js
const gateway = new Gateway({
  llmOptions: {
    provider: "openai",
    apiKey: process.env.LLM_API_KEY,
    model: "gpt-4o-mini"
  }
});
```

## Configuration

All policies are configured through `config/policy.yaml`.

```yaml
rules:
  block_competitor_mentions: true

  competitors:
    - "OpenAI"
    - "Google Gemini"

  block_medical_advice: true

  disallowed_phrases:
    - "100% safe"

retry:
  enabled: true
  max_attempts: 2

fallback:
  message: "Unable to provide a compliant response."
```

No code changes are required when updating rules.

## Example Guardrails

### Input

* Prompt injection detection
* PII redaction
* Toxic content filtering
* Length limits

### Output

* JSON schema validation
* Competitor mention blocking
* Medical advice blocking
* Required/disallowed phrases
* Toxicity checks

## Testing

Run the full test suite:

```bash
npm test
```

Tests use the built-in mock provider and require no API keys.
