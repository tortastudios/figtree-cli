/**
 * Logging system with different levels and formatting
 */
import chalk from 'chalk'
import { isDebugMode } from './config.js'

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
}

// Current log level (can be overridden by environment)
let currentLogLevel = isDebugMode() ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO

/**
 * Set log level
 * @param {number} level - Log level from LOG_LEVELS
 */
export function setLogLevel(level) {
  currentLogLevel = level
}

/**
 * Get current log level
 * @returns {number} Current log level
 */
export function getLogLevel() {
  return currentLogLevel
}

/**
 * Format timestamp for logs
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString()
}

/**
 * Format log message with level, timestamp, and styling
 * @param {string} level - Log level name
 * @param {string} message - Log message
 * @param {Function} colorFn - Chalk color function
 * @returns {string} Formatted log message
 */
function formatMessage(level, message, colorFn = chalk.white) {
  if (isDebugMode()) {
    const timestamp = chalk.gray(`[${getTimestamp()}]`)
    const levelStr = colorFn(`[${level}]`)
    return `${timestamp} ${levelStr} ${message}`
  }
  return message
}

/**
 * Log error message
 * @param {string|Error} message - Error message or Error object
 * @param {Object} [context] - Additional context
 */
export function error(message, context = {}) {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    const errorMsg = message instanceof Error ? message.message : message
    const stack = message instanceof Error ? message.stack : null

    console.error(formatMessage('ERROR', chalk.red(errorMsg), chalk.red))

    if (stack && isDebugMode()) {
      console.error(chalk.gray(stack))
    }

    if (Object.keys(context).length > 0 && isDebugMode()) {
      console.error(chalk.gray('Context:'), context)
    }
  }
}

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {Object} [context] - Additional context
 */
export function warn(message, context = {}) {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', chalk.yellow(message), chalk.yellow))

    if (Object.keys(context).length > 0 && isDebugMode()) {
      console.warn(chalk.gray('Context:'), context)
    }
  }
}

/**
 * Log info message
 * @param {string} message - Info message
 * @param {Object} [context] - Additional context
 */
export function info(message, context = {}) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.info(formatMessage('INFO', chalk.blue(message), chalk.blue))

    if (Object.keys(context).length > 0 && isDebugMode()) {
      console.info(chalk.gray('Context:'), context)
    }
  }
}

/**
 * Log debug message
 * @param {string} message - Debug message
 * @param {Object} [context] - Additional context
 */
export function debug(message, context = {}) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.debug(formatMessage('DEBUG', chalk.gray(message), chalk.gray))

    if (Object.keys(context).length > 0) {
      console.debug(chalk.gray('Context:'), context)
    }
  }
}

/**
 * Log trace message (most verbose)
 * @param {string} message - Trace message
 * @param {Object} [context] - Additional context
 */
export function trace(message, context = {}) {
  if (currentLogLevel >= LOG_LEVELS.TRACE) {
    console.trace(formatMessage('TRACE', chalk.dim(message), chalk.dim))

    if (Object.keys(context).length > 0) {
      console.trace(chalk.gray('Context:'), context)
    }
  }
}

/**
 * Log success message (special info variant)
 * @param {string} message - Success message
 */
export function success(message) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.info(formatMessage('SUCCESS', chalk.green(message), chalk.green))
  }
}

/**
 * Log app title/header
 * @param {string} title - App title
 * @param {string} [subtitle] - App subtitle
 */
export function header(title, subtitle = '') {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(
      chalk.blue.bold(title) + (subtitle ? chalk.gray(` - ${subtitle}`) : '')
    )
  }
}

/**
 * Log section separator
 * @param {string} message - Section message
 */
export function section(message) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(chalk.cyan(`\n📋 ${message}`))
  }
}

/**
 * Log progress/status message
 * @param {string} message - Progress message
 */
export function progress(message) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(chalk.blue(`⏳ ${message}`))
  }
}

/**
 * Log completion message
 * @param {string} message - Completion message
 */
export function complete(message) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(chalk.green(`✅ ${message}`))
  }
}

/**
 * Log API request details (debug level)
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Object} [options] - Request options
 */
export function apiRequest(method, url, options = {}) {
  debug(`API Request: ${method} ${url}`, { options })
}

/**
 * Log API response details (debug level)
 * @param {number} status - Response status
 * @param {string} url - Request URL
 * @param {number} [responseTime] - Response time in ms
 */
export function apiResponse(status, url, responseTime) {
  const statusColor = status >= 200 && status < 300 ? chalk.green : chalk.red
  debug(`API Response: ${statusColor(status)} ${url}`, { responseTime })
}

/**
 * Log token usage information
 * @param {number} originalTokens - Original token count
 * @param {number} compressedTokens - Compressed token count
 * @param {string} [context] - Additional context
 */
export function tokenUsage(originalTokens, compressedTokens, context = '') {
  const reduction = Math.round(
    ((originalTokens - compressedTokens) / originalTokens) * 100
  )
  const message = `Token usage${
    context ? ` (${context})` : ''
  }: ${originalTokens.toLocaleString()} → ${compressedTokens.toLocaleString()} (${reduction}% reduction)`
  info(message)
}

/**
 * Log file operation
 * @param {string} operation - Operation type (read, write, delete)
 * @param {string} filename - File name
 * @param {string} [result] - Operation result
 */
export function fileOperation(operation, filename, result = 'success') {
  const icon =
    operation === 'read' ? '📖' : operation === 'write' ? '💾' : '🗑️'
  const message = `${icon} ${operation} ${filename}: ${result}`
  info(message)
}

/**
 * Log user interaction
 * @param {string} interaction - Interaction type
 * @param {string} [value] - User's choice/input
 */
export function userInteraction(interaction, value = '') {
  debug(`User ${interaction}${value ? `: ${value}` : ''}`)
}

/**
 * Create a performance timer
 * @param {string} name - Timer name
 * @returns {Function} End timer function
 */
export function startTimer(name) {
  const start = Date.now()
  debug(`Timer started: ${name}`)

  return function endTimer() {
    const duration = Date.now() - start
    debug(`Timer ended: ${name} (${duration}ms)`)
    return duration
  }
}

/**
 * Log raw message without formatting (for prompts, etc.)
 * @param {string} message - Raw message
 */
export function raw(message) {
  console.log(message)
}

/**
 * Log message with custom color
 * @param {string} message - Message
 * @param {string} color - Chalk color name
 */
export function colored(message, color = 'white') {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(chalk[color](message))
  }
}

// Export default logger object
export default {
  error,
  warn,
  info,
  debug,
  trace,
  success,
  header,
  section,
  progress,
  complete,
  apiRequest,
  apiResponse,
  tokenUsage,
  fileOperation,
  userInteraction,
  startTimer,
  raw,
  colored,
  setLogLevel,
  getLogLevel,
  LOG_LEVELS
}
