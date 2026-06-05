/**
 * Gateway
 * Orchestrates the full LLM Guardrails pipeline:
 *
 *  User Prompt
 *      │
 *      ▼
 *  ┌─────────────────┐
 *  │  InputGuardrail │  ← detect injections, PII, toxic input
 *  └────────┬────────┘
 *           │ (if allowed)
 *           ▼
 *  ┌─────────────────┐
 *  │   LLM Adapter   │  ← call the actual LLM
 *  └────────┬────────┘
 *           │
 *           ▼
 *  ┌──────────────────┐
 *  │ OutputGuardrail  │  ← validate schema, policy rules, toxic output
 *  └────────┬─────────┘
 *           │ (if violation)
 *           ▼
 *  ┌─────────────────┐
 *  │   Retry / Fix   │  ← re-prompt LLM with correction instruction
 *  └────────┬────────┘
 *           │ (if still failing)
 *           ▼
 *  ┌─────────────────┐
 *  │ Safe Fallback   │  ← return configured fallback message
 *  └─────────────────┘
 */

const path           = require("path");
const PolicyEngine   = require("../policy/policy_engine");
const InputGuardrail = require("../guardrails/input_guardrail");
const OutputGuardrail= require("../guardrails/output_guardrail");
const LLMAdapter     = require("./llm_adapter");

class Gateway {
  /**
   * @param {{
   *   policyPath?: string,
   *   llmOptions?: object,
   *   logger?:    (level: string, message: string, data?: any) => void
   * }} options
   */
  constructor(options = {}) {
    this.policy   = new PolicyEngine(options.policyPath || path.join(__dirname, "../../config/policy.yaml"));
    this.input    = new InputGuardrail(this.policy);
    this.output   = new OutputGuardrail(this.policy);
    this.llm      = new LLMAdapter(options.llmOptions || { provider: "mock" });
    this.logger   = options.logger || this._defaultLogger;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Process a user prompt through the full guardrails pipeline.
   *
   * @param {string} userPrompt
   * @param {string} [systemPrompt]
   * @returns {Promise<GatewayResult>}
   *
   * @typedef {Object} GatewayResult
   * @property {boolean}  success        - true if a valid response was produced
   * @property {string}   response       - final text to return to the user
   * @property {boolean}  usedFallback   - true if the fallback message was returned
   * @property {number}   attempts       - how many LLM calls were made
   * @property {object[]} inputViolations
   * @property {object[]} inputWarnings
   * @property {object[]} outputViolations
   * @property {object[]} outputWarnings
   */
  async process(userPrompt, systemPrompt) {
    this.logger("info", "Gateway.process() started", { promptLength: userPrompt.length });

    // ── Step 1: Input Guardrail ────────────────────────────────────────────
    const inputResult = this.input.check(userPrompt);

    if (!inputResult.allowed) {
      this.logger("warn", "Input blocked by guardrail", { violations: inputResult.violations });
      return {
        success:          false,
        response:         this.policy.fallback.message,
        usedFallback:     true,
        attempts:         0,
        inputViolations:  inputResult.violations,
        inputWarnings:    inputResult.warnings,
        outputViolations: [],
        outputWarnings:   []
      };
    }

    if (inputResult.warnings.length > 0) {
      this.logger("info", "Input warnings (PII redacted)", { warnings: inputResult.warnings });
    }

    // Use sanitized prompt for the LLM call
    const sanitizedPrompt = inputResult.sanitized;

    // ── Step 2 + 3: LLM call + Output Guardrail (with retries) ───────────
    const retryPolicy  = this.policy.retry;
    const maxAttempts  = retryPolicy.enabled ? (retryPolicy.max_attempts || 1) + 1 : 1;
    let   attempt      = 0;
    let   lastResponse = "";
    let   lastOutputResult;
    let   currentSystemPrompt = systemPrompt;

    while (attempt < maxAttempts) {
      attempt++;
      this.logger("info", `LLM call attempt ${attempt}/${maxAttempts}`);

      try {
        lastResponse = await this.llm.complete(sanitizedPrompt, currentSystemPrompt);
      } catch (err) {
        this.logger("error", `LLM call failed: ${err.message}`);
        return this._fallbackResult(attempt, [], [], inputResult);
      }

      this.logger("info", "LLM responded", { responseLength: lastResponse.length });

      // ── Step 3: Output Guardrail ─────────────────────────────────────────
      lastOutputResult = this.output.check(lastResponse);

      if (lastOutputResult.allowed) {
        this.logger("info", "Output passed guardrail", { attempt });
        return {
          success:          true,
          response:         lastResponse,
          usedFallback:     false,
          attempts:         attempt,
          inputViolations:  inputResult.violations,
          inputWarnings:    inputResult.warnings,
          outputViolations: lastOutputResult.violations,
          outputWarnings:   lastOutputResult.warnings,
          parsed:           lastOutputResult.parsed || null
        };
      }

      this.logger("warn", `Output blocked (attempt ${attempt})`, { violations: lastOutputResult.violations });

      // ── Step 4: Correction prompt for retry ──────────────────────────────
      if (attempt < maxAttempts && retryPolicy.enabled) {
        currentSystemPrompt = retryPolicy.correction_prompt +
          "\n\nViolations detected:\n" +
          lastOutputResult.violations.map(v => `- ${v.message}`).join("\n");
        this.logger("info", "Retrying with correction prompt");
      }
    }

    // ── Step 5: Fallback ──────────────────────────────────────────────────
    this.logger("warn", "All attempts exhausted — returning fallback");
    return this._fallbackResult(attempt, lastOutputResult.violations, lastOutputResult.warnings, inputResult);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _fallbackResult(attempts, outputViolations, outputWarnings, inputResult) {
    return {
      success:          false,
      response:         this.policy.fallback.message,
      usedFallback:     true,
      attempts,
      inputViolations:  inputResult ? inputResult.violations : [],
      inputWarnings:    inputResult ? inputResult.warnings   : [],
      outputViolations,
      outputWarnings
    };
  }

  _defaultLogger(level, message, data) {
    const ts    = new Date().toISOString();
    const extra = data ? " " + JSON.stringify(data) : "";
    console.log(`[${ts}] [${level.toUpperCase()}] ${message}${extra}`);
  }
}

module.exports = Gateway;
