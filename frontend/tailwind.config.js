/**
 * Dark mode works by repointing the palette, not by adding `dark:` to every
 * class. The screens are written with plain palette classes (`bg-white`,
 * `text-slate-600`, `border-slate-200`, `bg-red-50 text-red-700`), so the
 * shades that only make sense on a light page are swapped here for CSS
 * variables, and those variables change when <html> has the `dark` class:
 *
 *   - surfaces (`bg-white`) become pure black, and the faint neutral fills
 *     (`bg-slate-50/100/200`) become faint greys, so hover and selection
 *     still show;
 *   - dark text (`text-slate-900`, `text-red-700`) becomes light text;
 *   - light borders become dark ones;
 *   - pale tints (`bg-blue-50`) become deep tints of the same hue.
 *
 * Each property is mapped on its own, because one class name means opposite
 * things in each: `text-blue-700` is a dark label to brighten, while
 * `bg-blue-700` is a button behind white text and must stay as it is. Solid
 * colours (the 400–900 backgrounds, `text-white`) are left alone.
 *
 * In light mode every variable holds Tailwind's own value, so the light theme
 * is exactly what the classes say. Anything Tailwind cannot see — an arbitrary
 * value like `bg-[#fdebeb]`, an inline style — needs its own `dark:` variant.
 */

const colors = require("tailwindcss/colors");

const NEUTRALS = ["slate", "gray", "zinc", "neutral", "stone"];
const HUES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

// Every neutral family is one plain grey in dark mode: a blue-grey cast is
// what makes a "black" theme read as navy.
const DARK_NEUTRAL = {
  bg: { 50: "#0c0c0c", 100: "#161616", 200: "#222222", 300: "#333333", 400: "#404040", 500: "#6b6b6b" },
  text: {
    300: "#4a4a4a", 400: "#6e6e6e", 500: "#8f8f8f", 600: "#a3a3a3",
    700: "#d4d4d4", 800: "#e5e5e5", 900: "#f2f2f2", 950: "#f2f2f2",
  },
  border: { 50: "#141414", 100: "#1a1a1a", 200: "#262626", 300: "#363636", 400: "#525252" },
  shadow: { 50: "#000000", 100: "#000000", 200: "#000000", 300: "#000000" },
};

/** `#abc` / `#aabbcc` → [r, g, b] */
function rgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** `hex` laid over black at `amount` opacity, as an opaque colour. */
function overBlack(hex, amount) {
  return "#" + rgb(hex).map((c) => Math.round(c * amount).toString(16).padStart(2, "0")).join("");
}

/** A hue's dark shades come from the other end of its own scale. */
function darkHue(s) {
  return {
    bg: { 50: overBlack(s[950], 0.45), 100: overBlack(s[950], 0.7), 200: s[950] },
    text: { 500: s[400], 600: s[400], 700: s[300], 800: s[200], 900: s[100], 950: s[50] },
    border: { 50: overBlack(s[950], 0.6), 100: s[950], 200: overBlack(s[900], 0.75), 300: overBlack(s[800], 0.8) },
  };
}

// property → Tailwind theme key and variable prefix
const PROPS = {
  bg: "backgroundColor",
  text: "textColor",
  border: "borderColor",
  shadow: "boxShadowColor",
  from: "gradientColorStops",
};

// [prop, family, shade | null, light value, dark value]
const SWAPS = [
  ["bg", "white", null, colors.white, "#000000"],
  ["from", "white", null, colors.white, "#000000"],
];
for (const family of NEUTRALS) {
  for (const [prop, shades] of Object.entries(DARK_NEUTRAL)) {
    for (const [shade, dark] of Object.entries(shades)) {
      SWAPS.push([prop, family, shade, colors[family][shade], dark]);
    }
  }
}
for (const family of HUES) {
  for (const [prop, shades] of Object.entries(darkHue(colors[family]))) {
    for (const [shade, dark] of Object.entries(shades)) {
      SWAPS.push([prop, family, shade, colors[family][shade], dark]);
    }
  }
}

const themeSwaps = {};
const lightVars = {};
const darkVars = {};
for (const [prop, family, shade, light, dark] of SWAPS) {
  const name = `--${prop}-${family}${shade ? `-${shade}` : ""}`;
  const value = `rgb(var(${name}) / <alpha-value>)`;
  const key = PROPS[prop];
  themeSwaps[key] = themeSwaps[key] || {};
  if (shade) {
    themeSwaps[key][family] = { ...themeSwaps[key][family], [shade]: value };
  } else {
    themeSwaps[key][family] = value;
  }
  lightVars[name] = rgb(light).join(" ");
  darkVars[name] = rgb(dark).join(" ");
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      ...themeSwaps,
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    ({ addBase }) => addBase({ ":root": lightVars, ".dark": darkVars }),
  ],
}
