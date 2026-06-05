/**
 * PolicyEngine
 * Loads a YAML policy file and exposes rule evaluation helpers.
 * Non-engineers define rules in config/policy.yaml — no code changes needed.
 */

const fs   = require("fs");
const path = require("path");
const yaml = require("js-yaml");

class PolicyEngine {
  /**
   * @param {string} policyPath  Path to the YAML policy file
   */
  constructor(policyPath) {
    this.policyPath = policyPath || path.join(__dirname, "../../config/policy.yaml");
    this.policy     = this._load();
  }

  // ─── Loader ─────────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = fs.readFileSync(this.policyPath, "utf8");
      return yaml.load(raw);
    } catch (err) {
      throw new Error(`PolicyEngine: failed to load policy file at "${this.policyPath}": ${err.message}`);
    }
  }

  /** Hot-reload the policy (useful in long-running servers) */
  reload() {
    this.policy = this._load();
  }

  // ─── Accessors ───────────────────────────────────────────────────────────────

  get input()   { return this.policy.input   || {}; }
  get output()  { return this.policy.output  || {}; }
  get rules()   { return this.policy.rules   || {}; }
  get retry()   { return this.policy.retry   || { enabled: false, max_attempts: 1 }; }
  get fallback(){ return this.policy.fallback || { message: "Unable to process request." }; }

  // ─── Input Rule Evaluators ───────────────────────────────────────────────────

  /** Returns true if prompt-injection blocking is enabled */
  isPromptInjectionBlocked() {
    return !!this.input.block_prompt_injection;
  }

  getPromptInjectionPatterns() {
    return (this.input.prompt_injection_patterns || []).map(p => p.toLowerCase());
  }

  isPIIBlocked() {
    return !!this.input.block_pii;
  }

  getPIITypes() {
    return this.input.pii_types || [];
  }

  isInputToxicBlocked() {
    return !!this.input.block_toxic;
  }

  getInputToxicPatterns() {
    return (this.input.toxic_patterns || []).map(p => p.toLowerCase());
  }

  getMaxInputLength() {
    return this.input.max_length || 0;
  }

  // ─── Output Rule Evaluators ──────────────────────────────────────────────────

  getOutputSchema() {
    return this.output.schema || null;
  }

  isOutputToxicBlocked() {
    return !!this.output.block_toxic;
  }

  getMaxOutputLength() {
    return this.output.max_length || 0;
  }

  // ─── Business Rule Evaluators ────────────────────────────────────────────────

  isCompetitorMentionBlocked() {
    return !!this.rules.block_competitor_mentions;
  }

  getCompetitors() {
    return (this.rules.competitors || []).map(c => c.toLowerCase());
  }

  isMedicalAdviceBlocked() {
    return !!this.rules.block_medical_advice;
  }

  getMedicalAdvicePatterns() {
    return (this.rules.medical_advice_patterns || []).map(p => p.toLowerCase());
  }

  getDisallowedPhrases() {
    return (this.rules.disallowed_phrases || []).map(p => p.toLowerCase());
  }

  getRequiredPhrases() {
    return this.rules.required_phrases || [];
  }

  isCitationRequired() {
    return !!this.rules.require_citations;
  }
}

module.exports = PolicyEngine;
