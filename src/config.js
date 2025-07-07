/**
 * Configuration management with validation
 */
import dotenv from 'dotenv'
import {
  ENV_VARS,
  DEFAULT_CONFIG,
  VALIDATION_PATTERNS,
  ERROR_MESSAGES,
  AI_PROVIDERS,
  APP_CONFIG
} from './constants.js'

// Load environment variables
dotenv.config()

/**
 * Configuration validation error
 */
export class ConfigurationError extends Error {
  constructor(message, code = 'CONFIG_ERROR') {
    super(message)
    this.name = 'ConfigurationError'
    this.code = code
  }
}

/**
 * Validate and get Figma token
 * @returns {string} Validated Figma token
 * @throws {ConfigurationError} If token is missing or invalid
 */
export function getFigmaToken() {
  const token = process.env[ENV_VARS.FIGMA_TOKEN]

  if (!token) {
    throw new ConfigurationError(
      ERROR_MESSAGES.MISSING_FIGMA_TOKEN,
      'MISSING_FIGMA_TOKEN'
    )
  }

  // Basic token format validation
  if (!token.startsWith(VALIDATION_PATTERNS.FIGMA_TOKEN_PREFIX)) {
    throw new ConfigurationError(
      ERROR_MESSAGES.INVALID_FIGMA_TOKEN,
      'INVALID_FIGMA_TOKEN'
    )
  }

  return token
}

/**
 * Validate file key format
 * @param {string} fileKey - Figma file key
 * @returns {boolean} True if valid
 */
export function validateFileKey(fileKey) {
  return VALIDATION_PATTERNS.FIGMA_FILE_KEY.test(fileKey)
}

/**
 * Get available AI providers based on environment variables
 * @returns {Object} Available providers with their configuration
 */
export function getAvailableAIProviders() {
  const available = {}

  for (const [key, provider] of Object.entries(AI_PROVIDERS)) {
    const apiKey = process.env[provider.envKey]
    if (apiKey && apiKey.trim()) {
      available[key] = {
        ...provider,
        hasApiKey: true
      }
    }
  }

  return available
}

/**
 * Get API key for a specific provider
 * @param {string} provider - Provider name
 * @returns {string} API key
 * @throws {ConfigurationError} If API key is missing
 */
export function getProviderApiKey(provider) {
  const providerConfig = AI_PROVIDERS[provider]

  if (!providerConfig) {
    throw new ConfigurationError(
      `${ERROR_MESSAGES.UNKNOWN_PROVIDER}: ${provider}`,
      'UNKNOWN_PROVIDER'
    )
  }

  const apiKey = process.env[providerConfig.envKey]

  if (!apiKey || !apiKey.trim()) {
    throw new ConfigurationError(
      `${ERROR_MESSAGES.MISSING_API_KEY}: ${providerConfig.name}`,
      'MISSING_API_KEY'
    )
  }

  return apiKey
}

/**
 * Get output file path from environment or default
 * @returns {string} Output file path
 */
export function getOutputFile() {
  return process.env[ENV_VARS.FIGTREE_OUTPUT] || DEFAULT_CONFIG.outputFile
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} True if debug mode is enabled
 */
export function isDebugMode() {
  return (
    process.env[ENV_VARS.DEBUG] === 'true' ||
    process.env[ENV_VARS.DEBUG] === '1' ||
    process.env[ENV_VARS.NODE_ENV] === 'development'
  )
}

/**
 * Get application configuration
 * @returns {Object} Application configuration
 */
export function getAppConfig() {
  return {
    ...APP_CONFIG,
    debug: isDebugMode(),
    outputFile: getOutputFile(),
    maxRetries: DEFAULT_CONFIG.maxRetries,
    chunkSize: DEFAULT_CONFIG.chunkSize,
    timeout: DEFAULT_CONFIG.timeout
  }
}

/**
 * Validate all required configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
export function validateConfiguration() {
  try {
    // Validate Figma token
    getFigmaToken()

    // Check if at least one AI provider is available for AI mode
    const availableProviders = getAvailableAIProviders()

    return {
      figmaToken: true,
      aiProviders: Object.keys(availableProviders),
      hasAIProviders: Object.keys(availableProviders).length > 0,
      config: getAppConfig()
    }
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error
    }
    throw new ConfigurationError(
      `Configuration validation failed: ${error.message}`,
      'VALIDATION_ERROR'
    )
  }
}

/**
 * Get helpful setup instructions for missing configuration
 * @param {string} errorCode - Error code from ConfigurationError
 * @returns {string[]} Array of setup instructions
 */
export function getSetupInstructions(errorCode) {
  const instructions = []

  switch (errorCode) {
    case 'MISSING_FIGMA_TOKEN':
      instructions.push(
        '🔧 Setup Instructions:',
        '  1. Copy .env.example to .env:',
        '     cp .env.example .env',
        '',
        '  2. Get your Figma token:',
        `     ${APP_CONFIG.FIGMA_TOKEN_DOCS}`,
        '',
        '  3. Edit .env and add your token:',
        '     FIGMA_TOKEN=your_token_here',
        ''
      )
      break

    case 'INVALID_FIGMA_TOKEN':
      instructions.push(
        '⚠️  Token Format Warning:',
        `  Token should start with "${VALIDATION_PATTERNS.FIGMA_TOKEN_PREFIX}"`,
        '  Please check your token is correct',
        ''
      )
      break

    case 'MISSING_API_KEY':
      instructions.push(
        '🔑 AI Provider Setup:',
        '  Add API keys to your .env file:',
        '  • OPENAI_API_KEY for OpenAI',
        '  • GOOGLE_API_KEY for Google (Gemini)',
        '  • ANTHROPIC_API_KEY for Anthropic (Claude)',
        '  • DEEPSEEK_API_KEY for DeepSeek',
        ''
      )
      break

    default:
      instructions.push(
        '❌ Configuration Error:',
        '  Please check your .env file and try again',
        ''
      )
  }

  return instructions
}

/**
 * Configuration singleton
 */
let configInstance = null

/**
 * Get configuration instance (singleton)
 * @returns {Object} Configuration instance
 */
export function getConfig() {
  if (!configInstance) {
    configInstance = getAppConfig()
  }
  return configInstance
}

/**
 * Reset configuration instance (for testing)
 */
export function resetConfig() {
  configInstance = null
}
