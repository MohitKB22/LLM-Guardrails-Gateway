/**
 * InputGuardrail
 * Validates and sanitises incoming prompts before they reach the LLM.
 *
 * Checks (in order):
 *  1. Max length
 *  2. Prompt injection / jailbreak attempts
 *  3. Toxic / harmful content
 *  4. PII detection & redaction
 */

const { detectPII, redactPII } = require("../utils/pii_detector");

class InputGuardrail {
  /**
   * @param {import('../policy/policy_engine')} policy
   */
  constructor(policy) {
    this.policy = policy;
  }

  /**
   * Validate and (if needed) sanitise the user's prompt.
   *
   * @param {string} prompt
   * @returns {{
   *   allowed:     boolean,
   *   sanitized:   string,
   *   violations:  Array<{type:string, message:string}>,
   *   warnings:    Array<{type:string, message:string}>
   * }}
   */
  check(prompt) {
    const violations = [];
    const warnings   = [];
    let sanitized    = prompt;

    // ── 1. Length check ────────────────────────────────────────────────────
    const maxLen = this.policy.getMaxInputLength();
    if (maxLen > 0 && prompt.length > maxLen) {
      violations.push({
        type:    "max_length",
        message: `Prompt exceeds maximum allowed length of ${maxLen} characters (got ${prompt.length}).`
      });
    }

    const lower = prompt.toLowerCase();

    // ── 2. Prompt injection detection ─────────────────────────────────────
    if (this.policy.isPromptInjectionBlocked()) {
      for (const pattern of this.policy.getPromptInjectionPatterns()) {
        if (lower.includes(pattern)) {
          violations.push({
            type:    "prompt_injection",
            message: `Prompt injection / jailbreak attempt detected: "${pattern}".`
          });
          break; // one violation is enough to block
        }
      }
    }

    // ── 3. Toxic content detection ─────────────────────────────────────────
    if (this.policy.isInputToxicBlocked()) {
      for (const pattern of this.policy.getInputToxicPatterns()) {
        if (lower.includes(pattern)) {
          violations.push({
            type:    "toxic_content",
            message: `Toxic / harmful content detected: "${pattern}".`
          });
          break;
        }
      }
    }

    // ── 4. PII detection & redaction ───────────────────────────────────────
    if (this.policy.isPIIBlocked()) {
      const piiTypes         = this.policy.getPIITypes();
      const { found }        = detectPII(prompt, piiTypes);

      if (found.length > 0) {
        const { redacted, types } = redactPII(prompt, piiTypes);
        sanitized = redacted;
        warnings.push({
          type:    "pii_redacted",
          message: `PII detected and redacted: ${types.join(", ")}.`
        });
      }
    }

    const allowed = violations.length === 0;
    return { allowed, sanitized, violations, warnings };
  }
}

module.exports = InputGuardrail;
