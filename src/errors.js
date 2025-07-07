/**
 * Custom error types and error handling system
 */

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', statusCode = 1) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.timestamp = new Date().toISOString()

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Convert error to plain object
   * @returns {Object} Error object
   */
  toObject() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends AppError {
  constructor(message, code = 'CONFIG_ERROR') {
    super(message, code, 1)
  }
}

/**
 * Figma API-related errors
 */
export class FigmaAPIError extends AppError {
  constructor(message, code = 'FIGMA_API_ERROR', statusCode = 1) {
    super(message, code, statusCode)
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends AppError {
  constructor(message, code = 'AUTH_ERROR') {
    super(message, code, 1)
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends AppError {
  constructor(message, code = 'NETWORK_ERROR') {
    super(message, code, 1)
  }
}

/**
 * AI provider errors
 */
export class AIProviderError extends AppError {
  constructor(message, code = 'AI_PROVIDER_ERROR') {
    super(message, code, 1)
  }
}

/**
 * File system errors
 */
export class FileSystemError extends AppError {
  constructor(message, code = 'FILE_SYSTEM_ERROR') {
    super(message, code, 1)
  }
}

/**
 * User input/validation errors
 */
export class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message, code, 1)
  }
}

/**
 * User cancelled operation
 */
export class UserCancelledError extends AppError {
  constructor(
    message = 'Operation cancelled by user',
    code = 'USER_CANCELLED'
  ) {
    super(message, code, 0) // Exit code 0 for user cancellation
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', code = 'RATE_LIMIT_ERROR') {
    super(message, code, 1)
  }
}

/**
 * Handle different types of errors and provide appropriate error messages
 * @param {Error} error - The error to handle
 * @returns {Object} Error handling result
 */
export function handleError(error) {
  // If it's already an AppError, return it as-is
  if (error instanceof AppError) {
    return {
      error,
      shouldExit: true,
      exitCode: error.statusCode,
      userFriendly: true
    }
  }

  // Handle specific error types
  if (error.message?.includes('User force closed')) {
    return {
      error: new UserCancelledError(),
      shouldExit: true,
      exitCode: 0,
      userFriendly: true
    }
  }

  if (error.message?.includes('Missing API key')) {
    return {
      error: new ConfigurationError(error.message, 'MISSING_API_KEY'),
      shouldExit: true,
      exitCode: 1,
      userFriendly: true
    }
  }

  if (error.message?.includes('Invalid Figma token')) {
    return {
      error: new AuthenticationError(error.message, 'INVALID_FIGMA_TOKEN'),
      shouldExit: true,
      exitCode: 1,
      userFriendly: true
    }
  }

  if (error.message?.includes('rate limit')) {
    return {
      error: new RateLimitError(error.message),
      shouldExit: true,
      exitCode: 1,
      userFriendly: true
    }
  }

  if (error.message?.includes('Network error')) {
    return {
      error: new NetworkError(error.message),
      shouldExit: true,
      exitCode: 1,
      userFriendly: true
    }
  }

  if (error.message?.includes('Access denied')) {
    return {
      error: new FigmaAPIError(error.message, 'ACCESS_DENIED'),
      shouldExit: true,
      exitCode: 1,
      userFriendly: true
    }
  }

  if (error.message?.includes('Resource not found')) {
    return {
      error: new FigmaAPIError(error.message, 'RESOURCE_NOT_FOUND'),
      shouldExit: true,
      exitCode: 1,
      userFriendly: true
    }
  }

  // Handle unknown errors
  return {
    error: new AppError(
      `Unexpected error: ${error.message}`,
      'UNEXPECTED_ERROR',
      1
    ),
    shouldExit: true,
    exitCode: 1,
    userFriendly: false
  }
}

/**
 * Create error from HTTP response
 * @param {Response} response - HTTP response
 * @param {string} context - Error context
 * @returns {AppError} Appropriate error type
 */
export function createErrorFromResponse(response) {
  const status = response.status
  const statusText = response.statusText

  switch (status) {
    case 401:
      return new AuthenticationError(
        'Invalid Figma token or insufficient permissions',
        'INVALID_TOKEN'
      )
    case 403:
      return new AuthenticationError(
        'Access denied to Figma resource',
        'ACCESS_DENIED'
      )
    case 404:
      return new FigmaAPIError(
        'Figma resource not found',
        'RESOURCE_NOT_FOUND'
      )
    case 429:
      return new RateLimitError(
        'Rate limit exceeded. Please try again later.',
        'RATE_LIMIT_EXCEEDED'
      )
    case 500:
    case 502:
    case 503:
    case 504:
      return new FigmaAPIError(
        `Figma server error (${status}): ${statusText}`,
        'SERVER_ERROR'
      )
    default:
      return new FigmaAPIError(
        `Figma API error (${status}): ${statusText}`,
        'API_ERROR'
      )
  }
}

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} [context] - Error context
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context = 'Operation') {
  return async function(...args) {
    try {
      return await fn(...args)
    } catch (error) {
      const handled = handleError(error)

      // Add context to error message if not already present
      if (!handled.error.message.includes(context) && !handled.userFriendly) {
        handled.error.message = `${context} failed: ${handled.error.message}`
      }

      throw handled.error
    }
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Function result
 */
export async function retry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    shouldRetry = (error) =>
      error instanceof NetworkError || error instanceof RateLimitError
  } = options

  let lastError
  let delay = baseDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        break
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Exponential backoff
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw lastError
}

/**
 * Create a safe async function that won't throw
 * @param {Function} fn - Async function
 * @returns {Function} Safe function that returns [error, result]
 */
export function safe(fn) {
  return async function(...args) {
    try {
      const result = await fn(...args)
      return [null, result]
    } catch (error) {
      return [error, null]
    }
  }
}

/**
 * Exit codes for different error types
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIGURATION_ERROR: 2,
  AUTHENTICATION_ERROR: 3,
  NETWORK_ERROR: 4,
  RATE_LIMIT_ERROR: 5,
  VALIDATION_ERROR: 6,
  FILE_SYSTEM_ERROR: 7,
  AI_PROVIDER_ERROR: 8,
  USER_CANCELLED: 0
}

/**
 * Get appropriate exit code for error
 * @param {Error} error - Error object
 * @returns {number} Exit code
 */
export function getExitCode(error) {
  if (error instanceof UserCancelledError) return EXIT_CODES.USER_CANCELLED
  if (error instanceof ConfigurationError) {
    return EXIT_CODES.CONFIGURATION_ERROR
  }
  if (error instanceof AuthenticationError) {
    return EXIT_CODES.AUTHENTICATION_ERROR
  }
  if (error instanceof NetworkError) return EXIT_CODES.NETWORK_ERROR
  if (error instanceof RateLimitError) return EXIT_CODES.RATE_LIMIT_ERROR
  if (error instanceof ValidationError) return EXIT_CODES.VALIDATION_ERROR
  if (error instanceof FileSystemError) return EXIT_CODES.FILE_SYSTEM_ERROR
  if (error instanceof AIProviderError) return EXIT_CODES.AI_PROVIDER_ERROR

  return EXIT_CODES.GENERAL_ERROR
}

/**
 * Format error for display to user
 * @param {Error} error - Error to format
 * @returns {Object} Formatted error information
 */
export function formatError(error) {
  const handled = handleError(error)
  const err = handled.error

  return {
    message: err.message,
    code: err.code,
    timestamp: err.timestamp,
    shouldExit: handled.shouldExit,
    exitCode: handled.exitCode,
    userFriendly: handled.userFriendly,
    stack: err.stack
  }
}
