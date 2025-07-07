#!/usr/bin/env node

/**
 * Prepare script for npm package setup
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { access, chmod, constants } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

/**
 * Make CLI executable
 */
async function makeExecutable() {
  const binPath = join(rootDir, "bin", "figtree.js");

  try {
    await access(binPath, constants.F_OK);
    await chmod(binPath, "755");
    console.log("✅ Made bin/figtree.js executable");
  } catch (error) {
    console.warn(
      "⚠️  Could not make bin/figtree.js executable:",
      error.message
    );
  }
}

/**
 * Check for .env.example
 */
async function checkEnvExample() {
  const envExamplePath = join(rootDir, ".env.example");

  try {
    await access(envExamplePath, constants.F_OK);
    console.log("✅ .env.example found");
    console.log('📝 Run "cp .env.example .env" to set up your environment');
  } catch (error) {
    console.warn("⚠️  .env.example not found");
  }
}

/**
 * Main prepare function
 */
async function prepare() {
  console.log("🔧 Setting up figtree package...");

  await makeExecutable();
  await checkEnvExample();

  console.log("✅ Package setup complete!");
  console.log("");
  console.log("Next steps:");
  console.log("1. Copy .env.example to .env");
  console.log("2. Add your Figma token to .env");
  console.log('3. Run "npx figtree" or "figtree" if installed globally');
}

// Run prepare if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  prepare().catch((error) => {
    console.error("❌ Prepare script failed:", error.message);
    process.exit(1);
  });
}
