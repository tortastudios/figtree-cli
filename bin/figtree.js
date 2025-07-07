#!/usr/bin/env node

import { run } from '../src/index.js'
import { validateConfiguration } from '../src/config.js'
import { handleError, getExitCode } from '../src/errors.js'
import logger from '../src/logger.js'
import { APP_CONFIG } from '../src/constants.js'

// Polyfill fetch using undici for Node.js
import { fetch, Headers, Request, Response } from 'undici'
if (!globalThis.fetch) {
  globalThis.fetch = fetch
  globalThis.Headers = Headers
  globalThis.Request = Request
  globalThis.Response = Response
}

/**
 * Show help message
 */
function showHelp() {
  logger.header(
    '🌳 figtree',
    'Extract design tokens from Figma and convert them to various code formats'
  )
  logger.raw('')
  logger.colored('Usage:', 'yellow')
  logger.raw('  figtree [options]')
  logger.raw('')
  logger.colored('Options:', 'yellow')
  logger.raw('  -h, --help     Show this help message')
  logger.raw('  -v, --version  Show version number')
  logger.raw(
    '  -o, --output   Specify output file path (default: ./figtree-prompt.txt)'
  )
  logger.raw('  -t, --token    Provide Figma token directly (overrides .env)')
  logger.raw('  -d, --debug    Enable debug logging')
  logger.raw('')
  logger.colored('Examples:', 'yellow')
  logger.raw('  figtree                                    # Interactive mode')
  logger.raw(
    '  figtree --output my-prompt.txt             # Custom output file'
  )
  logger.raw('  figtree --token your_figma_token_here      # Direct token')
  logger.raw(
    '  figtree --debug                            # Enable debug logging'
  )
  logger.raw('')
  logger.colored('Setup:', 'yellow')
  logger.raw('  1. Copy .env.example to .env')
  logger.raw('  2. Add your Figma token to .env')
  logger.raw('  3. Run figtree')
  logger.raw('')
  logger.colored('Get your Figma token at:', 'gray')
  logger.raw('  https://www.figma.com/developers/api#access-tokens')
}

/**
 * Show version information
 */
async function showVersion() {
  try {
    const { readFileSync } = await import('fs')
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    logger.raw(pkg.version)
  } catch (error) {
    logger.raw(APP_CONFIG.VERSION)
  }
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {
    output: null,
    token: null,
    debug: false,
    help: false,
    version: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true
        break

      case '-v':
      case '--version':
        options.version = true
        break

      case '-d':
      case '--debug':
        options.debug = true
        break

      case '-o':
      case '--output':
        if (i + 1 < args.length) {
          options.output = args[i + 1]
          i++ // Skip next argument since we consumed it
        } else {
          throw new Error('--output requires a file path')
        }
        break

      case '-t':
      case '--token':
        if (i + 1 < args.length) {
          options.token = args[i + 1]
          i++ // Skip next argument since we consumed it
        } else {
          throw new Error('--token requires a token value')
        }
        break

      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option '${arg}'`)
        }
        break
    }
  }

  return options
}

/**
 * Main CLI function
 * @returns {Promise<number>} Exit code
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2)
    const options = parseArgs(args)

    // Handle help and version flags
    if (options.help) {
      showHelp()
      return 0
    }

    if (options.version) {
      await showVersion()
      return 0
    }

    // Set debug mode if requested
    if (options.debug) {
      logger.setLogLevel(logger.LOG_LEVELS.DEBUG)
      process.env.DEBUG = 'true'
    }

    // Set token from CLI if provided
    if (options.token) {
      process.env.FIGMA_TOKEN = options.token
    }

    // Set output file for the app to use
    if (options.output) {
      process.env.FIGTREE_OUTPUT = options.output
    }

    // Validate configuration before starting
    try {
      const config = validateConfiguration()
      logger.debug('Configuration validated successfully', config)
    } catch (configError) {
      logger.error('Configuration validation failed', { error: configError })

      // Show helpful setup instructions
      if (configError.code) {
        const { getSetupInstructions } = await import('../src/config.js')
        const instructions = getSetupInstructions(configError.code)
        instructions.forEach((instruction) => logger.raw(instruction))
      }

      return getExitCode(configError)
    }

    // Start the application
    logger.debug('Starting figtree application')
    await run()

    logger.debug('Application completed successfully')
    return 0
  } catch (error) {
    // Handle any errors that occur during startup or execution
    const handled = handleError(error)
    const exitCode = getExitCode(handled.error)

    logger.error(handled.error.message, {
      code: handled.error.code,
      exitCode
    })

    // Show stack trace in debug mode
    if (logger.getLogLevel() >= logger.LOG_LEVELS.DEBUG) {
      logger.debug('Stack trace:', { stack: handled.error.stack })
    }

    return exitCode
  }
}

// Run the main function and exit with appropriate code
main()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((error) => {
    // This should never happen, but just in case
    logger.error('Unexpected error in main process', error)
    process.exit(1)
  })
