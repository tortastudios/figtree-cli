import inquirer from "inquirer";
import { validateFileKey } from "./figma.js";
import {
  getAvailableProviders,
  hasAvailableProviders,
  getProviderModels,
  getProviderInfo,
} from "./ai-providers.js";
import logger from "./logger.js";

// Extract file key from Figma URL
function extractFileKeyFromUrl(input) {
  // Remove whitespace
  const cleaned = input.trim();

  // Check if it's a URL
  if (cleaned.includes("figma.com") && cleaned.includes("/design/")) {
    // Extract the file key part
    const match = cleaned.match(/\/design\/([a-zA-Z0-9]+)\//);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If it's not a URL or extraction failed, return as-is
  return cleaned;
}

export async function promptForFileKey() {
  logger.raw("\n📝 To get your Figma file key or URL:");
  logger.raw("Option 1: Copy the entire Figma URL");
  logger.raw("   https://www.figma.com/design/FILE_KEY_HERE/File-Name");
  logger.raw(
    "   Example: https://www.figma.com/design/FVt1g2IuPzKJeQu8QlIGlA/My-Design"
  );
  logger.raw("");
  logger.raw("Option 2: Copy just the file key");
  logger.raw("   Example: FVt1g2IuPzKJeQu8QlIGlA");
  logger.raw("");

  const { fileKey } = await inquirer.prompt([
    {
      name: "fileKey",
      type: "input",
      message: "🔑 Enter your Figma URL or file key:",
      validate: (input) => {
        if (!input.trim()) {
          return "Figma URL or file key is required";
        }

        // Extract file key from URL if needed
        const extractedKey = extractFileKeyFromUrl(input.trim());

        if (!validateFileKey(extractedKey)) {
          return "Invalid Figma URL or file key format. Please enter a valid Figma URL or file key.";
        }
        return true;
      },
      filter: (input) => extractFileKeyFromUrl(input.trim()),
    },
  ]);

  return fileKey;
}

export async function confirmFileSelection(fileInfo) {
  logger.raw(`\n📄 File: ${fileInfo.name}`);
  logger.raw(
    `📅 Last modified: ${new Date(fileInfo.lastModified).toLocaleString()}`
  );
  logger.raw(`🔢 Version: ${fileInfo.version}`);

  const { confirmed } = await inquirer.prompt([
    {
      name: "confirmed",
      type: "confirm",
      message: "Is this the correct file?",
      default: true,
    },
  ]);

  return confirmed;
}

export async function selectFigmaFile(files) {
  const choices = files.map((f) => ({
    name: `${f.name} (${new Date(f.last_modified).toLocaleString()})`,
    value: f.key,
  }));

  const { fileKey } = await inquirer.prompt([
    {
      name: "fileKey",
      type: "list",
      message: "📁 Select a Figma file:",
      choices,
    },
  ]);

  return fileKey;
}

export async function chooseOutputFormat() {
  const { format } = await inquirer.prompt([
    {
      name: "format",
      type: "list",
      message: "🎯 Choose export format:",
      choices: ["Vanilla CSS", "PostCSS", "Tailwind", "Android XML", "SwiftUI"],
    },
  ]);

  return format;
}

// New AI-powered prompts
export async function chooseGenerationMode() {
  const hasProviders = hasAvailableProviders();

  const choices = [
    {
      name: "📝 Generate prompt only (copy-paste to AI)",
      value: "prompt",
      short: "Prompt only",
    },
  ];

  if (hasProviders) {
    choices.unshift({
      name: "🤖 Generate code directly using AI",
      value: "ai",
      short: "AI generation",
    });
  }

  const { mode } = await inquirer.prompt([
    {
      name: "mode",
      type: "list",
      message: "🎯 How would you like to generate code?",
      choices,
      default: hasProviders ? "ai" : "prompt",
    },
  ]);

  return mode;
}

export async function chooseAIProvider() {
  const availableProviders = getAvailableProviders();
  const providerKeys = Object.keys(availableProviders);

  if (providerKeys.length === 0) {
    throw new Error(
      "No AI providers available. Please set up API keys in your .env file."
    );
  }

  if (providerKeys.length === 1) {
    return providerKeys[0];
  }

  const choices = providerKeys.map((key) => ({
    name: `${availableProviders[key].name}`,
    value: key,
    short: availableProviders[key].name,
  }));

  const { provider } = await inquirer.prompt([
    {
      name: "provider",
      type: "list",
      message: "🤖 Choose AI provider:",
      choices,
    },
  ]);

  return provider;
}

export async function chooseModel(provider) {
  const models = getProviderModels(provider);
  const providerInfo = getProviderInfo(provider);

  if (Object.keys(models).length === 1) {
    return Object.keys(models)[0];
  }

  const choices = Object.entries(models).map(([key, name]) => ({
    name,
    value: key,
    short: name,
  }));

  const { model } = await inquirer.prompt([
    {
      name: "model",
      type: "list",
      message: `🧠 Choose ${providerInfo.name} model:`,
      choices,
      default: providerInfo.defaultModel,
    },
  ]);

  return model;
}

export async function chooseCodeFormat() {
  const { format } = await inquirer.prompt([
    {
      name: "format",
      type: "list",
      message: "📝 Choose code format:",
      choices: [
        { name: "CSS (Custom Properties)", value: "css" },
        { name: "SCSS (Variables & Mixins)", value: "scss" },
        { name: "Tailwind Config", value: "tailwind" },
        { name: "JavaScript/TypeScript", value: "javascript" },
        { name: "JSON (Design Tokens)", value: "json" },
        { name: "CSS Variables Only", value: "css-variables" },
        { name: "Android XML", value: "android" },
        { name: "SwiftUI", value: "swiftui" },
      ],
    },
  ]);

  return format;
}

export async function promptForOutputFile(format) {
  const extensions = {
    css: "css",
    scss: "scss",
    tailwind: "js",
    javascript: "js",
    json: "json",
    "css-variables": "css",
    android: "xml",
    swiftui: "swift",
  };

  const extension = extensions[format] || "txt";
  const defaultFile = `figma-styles.${extension}`;

  const { filename } = await inquirer.prompt([
    {
      name: "filename",
      type: "input",
      message: "📁 Output filename:",
      default: defaultFile,
      validate: (input) => {
        if (!input.trim()) {
          return "Filename is required";
        }
        return true;
      },
    },
  ]);

  return filename;
}
