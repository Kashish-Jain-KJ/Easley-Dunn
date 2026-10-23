/**
 * @file PlaceholderPage.js
 * @description Stands in for a section that has a place in the console but no
 * screen yet, so the rail stays complete while those are built.
 */

import React from "react";

export default function PlaceholderPage({ title }) {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto scroll-soft px-6 py-4">
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
        <h2 className="m-0 text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 mb-0 text-slate-600">This section is not built yet.</p>
      </div>
    </main>
  );
}
