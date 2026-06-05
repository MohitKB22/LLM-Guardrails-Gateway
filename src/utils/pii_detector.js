/**
 * PII Detector
 * Detects and redacts Personally Identifiable Information from text.
 */

const PII_PATTERNS = {
  credit_card: {
    // 13–19 digit numbers, optionally separated by spaces/dashes
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11}|\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{2,4})\b/g,
    label: "[CREDIT CARD REDACTED]"
  },
  ssn: {
    // US SSN: 000-00-0000
    regex: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    label: "[SSN REDACTED]"
  },
  email: {
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    label: "[EMAIL REDACTED]"
  },
  phone: {
    // Matches +1-800-555-1234, (800) 555-1234, 800.555.1234, etc.
    regex: /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
    label: "[PHONE REDACTED]"
  },
  ip_address: {
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    label: "[IP ADDRESS REDACTED]"
  }
};

/**
 * Detect PII types present in text.
 * @param {string} text
 * @param {string[]} types  - subset of PII_PATTERNS keys to check
 * @returns {{ found: string[], details: Array<{type,match}> }}
 */
function detectPII(text, types = Object.keys(PII_PATTERNS)) {
  const found   = [];
  const details = [];

  for (const type of types) {
    const pattern = PII_PATTERNS[type];
    if (!pattern) continue;

    // Reset lastIndex for global regex
    const regex   = new RegExp(pattern.regex.source, pattern.regex.flags);
    const matches = text.match(regex);

    if (matches && matches.length > 0) {
      found.push(type);
      matches.forEach(match => details.push({ type, match }));
    }
  }

  return { found, details };
}

/**
 * Redact PII from text, replacing matches with placeholder labels.
 * @param {string} text
 * @param {string[]} types
 * @returns {{ redacted: string, types: string[] }}
 */
function redactPII(text, types = Object.keys(PII_PATTERNS)) {
  let redacted     = text;
  const foundTypes = [];

  for (const type of types) {
    const pattern = PII_PATTERNS[type];
    if (!pattern) continue;

    const regex    = new RegExp(pattern.regex.source, pattern.regex.flags);
    const original = redacted;
    redacted       = redacted.replace(regex, pattern.label);

    if (redacted !== original) foundTypes.push(type);
  }

  return { redacted, types: foundTypes };
}

module.exports = { detectPII, redactPII, PII_PATTERNS };
