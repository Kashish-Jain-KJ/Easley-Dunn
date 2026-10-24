/**
 * @file passwordPolicy.js
 * @description The password rules, in one place, as a list the UI can show and
 * tick off while someone types.
 *
 * There are deliberately only two. NIST SP 800-63B rev 4 (August 2025) is
 * explicit that a verifier "SHALL NOT impose other composition rules (e.g.,
 * requiring mixtures of different character types)" — the upper-case-digit-
 * symbol checklist is not a stricter policy, it is a worse one, because it
 * pushes people toward predictable substitutions and writing passwords down.
 * Length is what actually helps.
 *
 * Every rule here is one the server enforces too. A rule shown but not checked
 * server-side teaches people the screen is decorative; a rule checked but not
 * shown is the problem this file exists to fix.
 */

/**
 * Enforced by the API in passwordAuth.controller.js. NIST asks for 15 on a
 * password-only sign-in; this is the number the server currently uses, and the
 * two must not drift apart — the browser must never accept what the API will
 * reject.
 */
export const MIN_LENGTH = 12;

/**
 * What the person still has to do, in the order they will do it.
 *
 * @param {string} password
 * @param {string} [confirm]  omit when the form has no second field
 * @returns {Array<{id: string, label: string, ok: boolean}>}
 */
export function passwordRules(password, confirm) {
  const rules = [
    {
      id: "length",
      label: `At least ${MIN_LENGTH} characters`,
      ok: password.length >= MIN_LENGTH,
    },
  ];

  if (confirm !== undefined) {
    rules.push({
      id: "match",
      // Says nothing while the second field is empty: an unmet rule should mean
      // "still to do", not "you have done this wrong" before they have typed.
      label: "Both entries match",
      ok: confirm.length > 0 && password === confirm,
    });
  }

  return rules;
}

/** True when every rule is satisfied. */
export function passwordIsValid(password, confirm) {
  return passwordRules(password, confirm).every((rule) => rule.ok);
}
