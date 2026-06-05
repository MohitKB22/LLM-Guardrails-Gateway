/**
 * OutputGuardrail
 * Validates the LLM's response before it is returned to the user.
 *
 * Checks:
 *  1. Max length
 *  2. Toxic content
 *  3. Schema conformance (optional JSON schema)
 *  4. Competitor mentions
 *  5. Medical advice
 *  6. Disallowed phrases
 *  7. Required phrases
 */

class OutputGuardrail {
  /**
   * @param {import('../policy/policy_engine')} policy
   */
  constructor(policy) {
    this.policy = policy;
  }

  /**
   * Validate the LLM's response.
   *
   * @param {string} response  - Raw LLM text response
   * @returns {{
   *   allowed:    boolean,
   *   violations: Array<{type:string, message:string}>,
   *   warnings:   Array<{type:string, message:string}>,
   *   parsed:     any|null   - Parsed object if schema === "json"
   * }}
   */
  check(response) {
    const violations = [];
    const warnings   = [];
    let   parsed     = null;
    const lower      = response.toLowerCase();

    // ── 1. Max length ──────────────────────────────────────────────────────
    const maxLen = this.policy.getMaxOutputLength();
    if (maxLen > 0 && response.length > maxLen) {
      violations.push({
        type:    "max_length",
        message: `Response exceeds maximum allowed length of ${maxLen} characters.`
      });
    }

    // ── 2. Toxic output ────────────────────────────────────────────────────
    if (this.policy.isOutputToxicBlocked()) {
      const toxic = this._findPattern(lower, [
        "step-by-step instructions to harm",
        "how to make explosives",
        "detailed guide to violence"
      ]);
      if (toxic) {
        violations.push({
          type:    "toxic_output",
          message: `Toxic content detected in LLM response: "${toxic}".`
        });
      }
    }

    // ── 3. Schema conformance ──────────────────────────────────────────────
    const schema = this.policy.getOutputSchema();
    if (schema === "json") {
      const result = this._validateJSON(response);
      if (!result.valid) {
        violations.push({
          type:    "schema_violation",
          message: `Response is not valid JSON: ${result.error}`
        });
      } else {
        parsed = result.data;
      }
    }

    // ── 4. Competitor mentions ─────────────────────────────────────────────
    if (this.policy.isCompetitorMentionBlocked()) {
      for (const competitor of this.policy.getCompetitors()) {
        if (lower.includes(competitor)) {
          violations.push({
            type:    "competitor_mention",
            message: `Response mentions a blocked competitor: "${competitor}".`
          });
          break;
        }
      }
    }

    // ── 5. Medical advice ──────────────────────────────────────────────────
    if (this.policy.isMedicalAdviceBlocked()) {
      const medMatch = this._findPattern(lower, this.policy.getMedicalAdvicePatterns());
      if (medMatch) {
        violations.push({
          type:    "medical_advice",
          message: `Response contains blocked medical advice: "${medMatch}".`
        });
      }
    }

    // ── 6. Disallowed phrases ──────────────────────────────────────────────
    const disallowed = this._findPattern(lower, this.policy.getDisallowedPhrases());
    if (disallowed) {
      violations.push({
        type:    "disallowed_phrase",
        message: `Response contains a disallowed phrase: "${disallowed}".`
      });
    }

    // ── 7. Required phrases ────────────────────────────────────────────────
    for (const phrase of this.policy.getRequiredPhrases()) {
      if (!lower.includes(phrase.toLowerCase())) {
        warnings.push({
          type:    "missing_required_phrase",
          message: `Response is missing required phrase: "${phrase}".`
        });
      }
    }

    const allowed = violations.length === 0;
    return { allowed, violations, warnings, parsed };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _findPattern(text, patterns) {
    for (const p of patterns) {
      if (text.includes(p)) return p;
    }
    return null;
  }

  _validateJSON(text) {
    // Try to extract JSON from within a markdown code block if present
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw    = fenced ? fenced[1].trim() : text.trim();

    try {
      return { valid: true, data: JSON.parse(raw), error: null };
    } catch (e) {
      return { valid: false, data: null, error: e.message };
    }
  }
}

module.exports = OutputGuardrail;
