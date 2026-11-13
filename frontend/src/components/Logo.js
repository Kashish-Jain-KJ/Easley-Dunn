/**
 * @file Logo.js
 * @description The Cerberus mark ("Gaze"): an open hexagon with two eyes.
 * The frame takes the text colour, so it is black on the light theme and white
 * on the dark one; the eyes stay red in both. Size it with className.
 *
 * KEEP IN SYNC with public/favicon.svg (same geometry).
 */

import React from "react";

export default function Logo({ className = "", title = "Cerberus" }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={title} className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="10">
        <polyline points="12,37 12,27 50,5 88,27 88,37" />
        <polyline points="12,63 12,73 50,95 88,73 88,63" />
      </g>
      <g fill="#E11D1D">
        <polygon points="16,38 47,51 23,56" />
        <polygon points="84,38 53,51 77,56" />
      </g>
    </svg>
  );
}
