/**
 * @file PasswordRules.js
 * @description The password requirements, shown as a list that ticks itself off
 * while someone types.
 *
 * Shown from the moment the field appears, not held back until something is
 * wrong — NN/g's finding on password constraints is that the rules have to be
 * visible *before* typing starts, because a rule you only learn by failing it
 * is a rule you had to fail first. Each line then updates on every keystroke,
 * so the field is trusted while it is being filled in rather than at submit.
 *
 * An unmet rule is grey and neutral, never red. Until they press the button
 * these are things still to do, not mistakes.
 */

import React from "react";
import { Check } from "lucide-react";

/**
 * @param {Object} props
 * @param {Array<{id: string, label: string, ok: boolean}>} props.rules
 * @param {string} [props.id] so the inputs can point at it with aria-describedby
 */
export default function PasswordRules({ rules, id }) {
  return (
    <ul id={id} className="list-none m-0 p-0 flex flex-col gap-1">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={`flex items-center gap-2 text-[13px] ${rule.ok ? "text-emerald-700" : "text-slate-500"}`}
        >
          <span
            aria-hidden="true"
            className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              rule.ok ? "bg-emerald-100" : "bg-slate-200"
            }`}
          >
            {rule.ok ? <Check className="w-3 h-3" strokeWidth={3} /> : <span className="w-1 h-1 rounded-full bg-slate-500" />}
          </span>
          {rule.label}
          {/* The icon is decorative, so the state is said in words for a screen
              reader rather than left to the colour. */}
          <span className="sr-only">{rule.ok ? " — done" : " — still needed"}</span>
        </li>
      ))}
    </ul>
  );
}
