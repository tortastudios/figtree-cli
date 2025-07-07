/**
 * Input validation and sanitization
 */
import { VALIDATION_PATTERNS } from './constants.js'
import { ValidationError } from './errors.js'

/**
 * Validate and sanitize string input
 * @param {any} input - Input to validate
 * @param {Object} options - Validation options
 * @returns {string} Sanitized string
 * @throws {ValidationError} If validation fails
 */
export function validateString(input, options = {}) {
  const {
    required = false,
    minLength = 0,
    maxLength = Infinity,
    pattern = null,
    allowEmpty = !required,
    trim = true,
    name = 'input'
  } = options

  // Type check
  if (typeof input !== 'string') {
    if (required) {
      throw new ValidationError(`${name} must be a string`)
    }
    return allowEmpty ? '' : null
  }

  // Trim whitespace if requested
  const sanitized = trim ? input.trim() : input

  // Check if empty
  if (!sanitized && !allowEmpty) {
    throw new ValidationError(`${name} cannot be empty`)
  }

  // Check minimum length
  if (sanitized.length < minLength) {
    throw new ValidationError(
      `${name} must be at least ${minLength} characters long`
    )
  }

  // Check maximum length
  if (sanitized.length > maxLength) {
    throw new ValidationError(
      `${name} must not exceed ${maxLength} characters`
    )
  }

  // Check pattern if provided
  if (pattern && !pattern.test(sanitized)) {
    throw new ValidationError(`${name} format is invalid`)
  }

  return sanitized
}

/**
 * Validate Figma file key
 * @param {string} fileKey - File key to validate
 * @returns {string} Validated file key
 * @throws {ValidationError} If file key is invalid
 */
export function validateFileKey(fileKey) {
  return validateString(fileKey, {
    required: true,
    pattern: VALIDATION_PATTERNS.FIGMA_FILE_KEY,
    name: 'File key',
    maxLength: 22
  })
}

/**
 * Validate Figma token
 * @param {string} token - Token to validate
 * @returns {string} Validated token
 * @throws {ValidationError} If token is invalid
 */
export function validateFigmaToken(token) {
  const validated = validateString(token, {
    required: true,
    minLength: 10,
    maxLength: 200,
    name: 'Figma token'
  })

  if (!validated.startsWith(VALIDATION_PATTERNS.FIGMA_TOKEN_PREFIX)) {
    throw new ValidationError(
      `Figma token should start with "${VALIDATION_PATTERNS.FIGMA_TOKEN_PREFIX}"`
    )
  }

  return validated
}

/**
 * Validate filename
 * @param {string} filename - Filename to validate
 * @returns {string} Validated filename
 * @throws {ValidationError} If filename is invalid
 */
export function validateFilename(filename) {
  const validated = validateString(filename, {
    required: true,
    minLength: 1,
    maxLength: 255,
    name: 'Filename'
  })

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/
  const hasControlChars = validated
    .split('')
    .some((char) => char.charCodeAt(0) < 32)
  if (invalidChars.test(validated) || hasControlChars) {
    throw new ValidationError('Filename contains invalid characters')
  }

  // Check for reserved names on Windows
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
  if (reservedNames.test(validated.split('.')[0])) {
    throw new ValidationError('Filename is reserved and cannot be used')
  }

  return validated
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {string} Validated email
 * @throws {ValidationError} If email is invalid
 */
export function validateEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return validateString(email, {
    required: true,
    pattern: emailPattern,
    name: 'Email',
    maxLength: 254
  })
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {string} Validated URL
 * @throws {ValidationError} If URL is invalid
 */
export function validateUrl(url) {
  const validated = validateString(url, {
    required: true,
    name: 'URL',
    maxLength: 2048
  })

  try {
    // eslint-disable-next-line no-new
    new URL(validated)
    return validated
  } catch (error) {
    throw new ValidationError('URL format is invalid')
  }
}

/**
 * Validate and sanitize object input
 * @param {any} input - Input to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Validated object
 * @throws {ValidationError} If validation fails
 */
export function validateObject(input, schema) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Input must be an object')
  }

  const result = {}
  const errors = []

  // Validate required fields
  for (const [key, rules] of Object.entries(schema)) {
    const value = input[key]

    try {
      if (rules.required && (value === undefined || value === null)) {
        throw new ValidationError(`${key} is required`)
      }

      if (value !== undefined && value !== null) {
        if (rules.type === 'string') {
          result[key] = validateString(value, { ...rules, name: key })
        } else if (rules.type === 'number') {
          result[key] = validateNumber(value, { ...rules, name: key })
        } else if (rules.type === 'boolean') {
          result[key] = validateBoolean(value, { ...rules, name: key })
        } else if (rules.type === 'array') {
          result[key] = validateArray(value, { ...rules, name: key })
        } else if (rules.validate) {
          result[key] = rules.validate(value)
        } else {
          result[key] = value
        }
      }
    } catch (error) {
      errors.push(`${key}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`Validation failed: ${errors.join(', ')}`)
  }

  return result
}

/**
 * Validate number input
 * @param {any} input - Input to validate
 * @param {Object} options - Validation options
 * @returns {number} Validated number
 * @throws {ValidationError} If validation fails
 */
export function validateNumber(input, options = {}) {
  const {
    required = false,
    min = -Infinity,
    max = Infinity,
    integer = false,
    name = 'number'
  } = options

  if (input === null || input === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`)
    }
    return null
  }

  const num = Number(input)

  if (isNaN(num)) {
    throw new ValidationError(`${name} must be a valid number`)
  }

  if (integer && !Number.isInteger(num)) {
    throw new ValidationError(`${name} must be an integer`)
  }

  if (num < min) {
    throw new ValidationError(`${name} must be at least ${min}`)
  }

  if (num > max) {
    throw new ValidationError(`${name} must not exceed ${max}`)
  }

  return num
}

/**
 * Validate boolean input
 * @param {any} input - Input to validate
 * @param {Object} options - Validation options
 * @returns {boolean} Validated boolean
 * @throws {ValidationError} If validation fails
 */
export function validateBoolean(input, options = {}) {
  const { required = false, name = 'boolean' } = options

  if (input === null || input === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`)
    }
    return null
  }

  if (typeof input === 'boolean') {
    return input
  }

  if (typeof input === 'string') {
    const lower = input.toLowerCase()
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false
    }
  }

  throw new ValidationError(`${name} must be a boolean value`)
}

/**
 * Validate array input
 * @param {any} input - Input to validate
 * @param {Object} options - Validation options
 * @returns {Array} Validated array
 * @throws {ValidationError} If validation fails
 */
export function validateArray(input, options = {}) {
  const {
    required = false,
    minLength = 0,
    maxLength = Infinity,
    itemValidator = null,
    name = 'array'
  } = options

  if (input === null || input === undefined) {
    if (required) {
      throw new ValidationError(`${name} is required`)
    }
    return null
  }

  if (!Array.isArray(input)) {
    throw new ValidationError(`${name} must be an array`)
  }

  if (input.length < minLength) {
    throw new ValidationError(
      `${name} must contain at least ${minLength} items`
    )
  }

  if (input.length > maxLength) {
    throw new ValidationError(
      `${name} must not contain more than ${maxLength} items`
    )
  }

  if (itemValidator) {
    return input.map((item, index) => {
      try {
        return itemValidator(item)
      } catch (error) {
        throw new ValidationError(`${name}[${index}]: ${error.message}`)
      }
    })
  }

  return input
}

/**
 * Sanitize HTML input (basic XSS prevention)
 * @param {string} input - HTML input to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(input) {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate API response structure
 * @param {any} response - API response to validate
 * @param {Object} schema - Expected response schema
 * @returns {Object} Validated response
 * @throws {ValidationError} If response is invalid
 */
export function validateApiResponse(response, schema) {
  if (!response) {
    throw new ValidationError('API response is empty')
  }

  if (typeof response !== 'object') {
    throw new ValidationError('API response must be an object')
  }

  return validateObject(response, schema)
}

/**
 * Validate environment variable
 * @param {string} name - Environment variable name
 * @param {string} value - Environment variable value
 * @param {Object} options - Validation options
 * @returns {string} Validated value
 * @throws {ValidationError} If validation fails
 */
export function validateEnvVar(name, value, options = {}) {
  const { required = false } = options

  if (!value) {
    if (required) {
      throw new ValidationError(`Environment variable ${name} is required`)
    }
    return null
  }

  return validateString(value, {
    ...options,
    name: `Environment variable ${name}`
  })
}

/**
 * Create a validator function for a specific type
 * @param {string} type - Type to validate
 * @param {Object} options - Validation options
 * @returns {Function} Validator function
 */
export function createValidator(type, options = {}) {
  switch (type) {
    case 'string':
      return (input) => validateString(input, options)
    case 'number':
      return (input) => validateNumber(input, options)
    case 'boolean':
      return (input) => validateBoolean(input, options)
    case 'array':
      return (input) => validateArray(input, options)
    case 'fileKey':
      return (input) => validateFileKey(input)
    case 'filename':
      return (input) => validateFilename(input)
    case 'email':
      return (input) => validateEmail(input)
    case 'url':
      return (input) => validateUrl(input)
    default:
      throw new ValidationError(`Unknown validator type: ${type}`)
  }
}
