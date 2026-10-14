#!/usr/bin/env node


// Script to fetch Logseq marketplace plugin package details from GitHub
// and generate an HTML page with a table of plugins.
// Usage: node update-catalog-index.js
// Output: catalog/index.html

/**
 * Parse command line arguments for verbose flag, max, and help
 */
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    `Usage: node update-catalog-index.js [--max <number>] [--verbose|-v] [--help|-h]\n\nOptions:\n  --max <number>   Limit the number of packages processed\n  --verbose, -v    Enable verbose logging\n  --help, -h       Show this help message`
  );
  process.exit(0);
}
const verbose = args.includes("--verbose") || args.includes("-v");
let maxItems;
const maxIdx = args.indexOf("--max");
if (maxIdx !== -1 && args.length > maxIdx + 1) {
  const val = parseInt(args[maxIdx + 1], 10);
  if (!isNaN(val) && val > 0) maxItems = val;
}

main({verbose}).then(() => {
  if (verbose) console.log("Script execution completed.");
  process.exit(0);
});

/**
 * Main entry point for fetching Logseq marketplace plugin data and generating HTML output.
 * @param {Object} options
 * @param {boolean} options.verbose - Enable verbose logging.
 */
async function main({verbose = false} = {}) {
  try {
    // Run the fetch script
    console.log("Fetching Logseq marketplace plugin data...");
    const fetchScript = await import("./fetch-plugins-data.js");
    await fetchScript.main({verbose, maxItems});

    // Run the generate script
    console.log("Generating HTML output...");
    const generateScript = await import("./generate-plugins-table-html.js");
    await generateScript.main({verbose});

    console.log("Done!");
  } catch (e) {
    console.error("Error caught in main:", e.message);
  }
}
