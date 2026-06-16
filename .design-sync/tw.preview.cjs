// Tailwind config for compiling .design-sync/compiled.css — extends the repo's
// own config but ALSO scans the authored previews so any utility class used
// only in a preview ends up in the shipped stylesheet. Run from repo root:
//   npx tailwindcss -c .design-sync/tw.preview.cjs -i app/globals.css -o .design-sync/compiled.css --minify
const base = require("../tailwind.config.js");
module.exports = {
  ...base,
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./.design-sync/previews/**/*.tsx",
  ],
};
