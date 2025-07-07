/**
 * Application constants and configuration
 */

// API Configuration
export const API_CONFIG = {
  FIGMA_BASE_URL: 'https://api.figma.com/v1',
  RATE_LIMIT_RETRY_DELAY: 60000, // 60 seconds
  SERVER_ERROR_RETRY_DELAY: 5000, // 5 seconds
  NETWORK_ERROR_RETRY_DELAY: 3000, // 3 seconds
  MAX_RETRIES: 3,
  REQUEST_TIMEOUT: 30000 // 30 seconds
}

// Token Limits for AI Models
export const TOKEN_LIMITS = {
  'o4-mini': 200_000,
  o3: 200_000,
  'o3-pro': 200_000,
  'o3-mini': 200_000,
  o1: 200_000,
  'o1-pro': 200_000,
  'gemini-2.5-pro': 1_048_576,
  'gemini-2.5-flash': 1_048_576,
  'claude-opus-4-20250514': 200_000,
  'claude-sonnet-4-20250514': 200_000,
  'deepseek-chat': 64_000,
  'deepseek-reasoner': 64_000
}

// Default token limits for unknown models
export const DEFAULT_TOKEN_LIMITS = {
  openai: 100_000,
  anthropic: 100_000,
  google: 100_000,
  deepseek: 64_000
}

// AI Provider Configuration
export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'o4-mini',
    models: {
      'o4-mini': 'o4-mini',
      o3: 'o3',
      'o3-pro': 'o3-pro',
      'o3-mini': 'o3-mini',
      o1: 'o1',
      'o1-pro': 'o1-pro'
    }
  },
  anthropic: {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    models: {
      'claude-opus-4-20250514': 'Claude 4 Opus',
      'claude-sonnet-4-20250514': 'Claude 4 Sonnet'
    }
  },
  google: {
    name: 'Google',
    envKey: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-2.5-pro',
    models: {
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-2.5-flash': 'Gemini 2.5 Flash'
    }
  },
  deepseek: {
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    models: {
      'deepseek-chat': 'DeepSeek Chat',
      'deepseek-reasoner': 'DeepSeek Reasoner'
    }
  }
}

// File Output Configuration
export const OUTPUT_CONFIG = {
  EXTENSIONS: {
    css: 'css',
    scss: 'scss',
    tailwind: 'js',
    javascript: 'js',
    json: 'json',
    'css-variables': 'css',
    android: 'xml',
    swiftui: 'swift'
  },
  DEFAULT_FILENAMES: {
    css: 'figma-styles.css',
    scss: 'figma-styles.scss',
    tailwind: 'tailwind.config.js',
    javascript: 'figma-tokens.js',
    json: 'figma-tokens.json',
    'css-variables': 'figma-variables.css',
    android: 'figma-styles.xml',
    swiftui: 'figma-styles.swift'
  },
  PROMPT_FILENAME: 'figtree-prompt.txt'
}

// Comment Formats for Code Generation
export const COMMENT_FORMATS = {
  css: '/* comment */',
  scss: '/* comment */',
  'css-variables': '/* comment */',
  tailwind: '// comment',
  javascript: '// comment',
  json: 'N/A - no comments in JSON',
  android: '<!-- comment -->',
  swiftui: '// comment'
}

// Validation Patterns
export const VALIDATION_PATTERNS = {
  FIGMA_FILE_KEY: /^[a-zA-Z0-9]{22}$/,
  FIGMA_TOKEN_PREFIX: 'figd_',
  FIGMA_URL_PATTERN:
    /^https:\/\/(?:www\.)?figma\.com\/(?:file|design)\/([a-zA-Z0-9]{22})\//
}

// Error Messages
export const ERROR_MESSAGES = {
  MISSING_FIGMA_TOKEN: 'Missing FIGMA_TOKEN environment variable',
  INVALID_FIGMA_TOKEN: 'Invalid Figma token format',
  INVALID_FILE_KEY: 'Invalid file key format',
  NETWORK_ERROR: 'Network error occurred',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  ACCESS_DENIED: 'Access denied to Figma resource',
  RESOURCE_NOT_FOUND: 'Figma resource not found',
  UNKNOWN_PROVIDER: 'Unknown AI provider',
  MISSING_API_KEY: 'Missing API key for provider'
}

// Success Messages
export const SUCCESS_MESSAGES = {
  FILE_VALIDATED: 'File found and validated!',
  STYLES_EXTRACTED: 'Styles extracted successfully!',
  CODE_GENERATED: 'Code generated successfully!',
  PROMPT_GENERATED: 'Prompt generated successfully!',
  FILE_SAVED: 'File saved successfully!'
}

// Application Configuration
export const APP_CONFIG = {
  NAME: 'figtree',
  VERSION: '1.0.0',
  DESCRIPTION:
    'Extract design tokens from Figma and convert them to various code formats',
  CHUNK_SIZE: 80_000, // Default chunk size for large files
  MAX_CHUNK_SIZE: 100_000, // Maximum chunk size
  PREVIEW_LENGTH: 500, // Characters to show in preview
  FIGMA_TOKEN_DOCS: 'https://www.figma.com/developers/api#access-tokens'
}

// Environment Variables
export const ENV_VARS = {
  FIGMA_TOKEN: 'FIGMA_TOKEN',
  FIGTREE_OUTPUT: 'FIGTREE_OUTPUT',
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  GOOGLE_API_KEY: 'GOOGLE_API_KEY',
  DEEPSEEK_API_KEY: 'DEEPSEEK_API_KEY',
  DEBUG: 'DEBUG',
  NODE_ENV: 'NODE_ENV'
}

// Default Configuration
export const DEFAULT_CONFIG = {
  outputFile: OUTPUT_CONFIG.PROMPT_FILENAME,
  maxRetries: API_CONFIG.MAX_RETRIES,
  chunkSize: APP_CONFIG.CHUNK_SIZE,
  timeout: API_CONFIG.REQUEST_TIMEOUT
}
