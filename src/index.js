import { getFileInfo, getStylesFromFile } from './figma.js'
import {
  promptForFileKey,
  confirmFileSelection,
  chooseGenerationMode,
  chooseAIProvider,
  chooseModel,
  chooseCodeFormat,
  promptForOutputFile
} from './prompts.js'
import { generatePrompt, savePromptToFile } from './export.js'
import {
  generateCodeFromStyles,
  generateDesignTokens,
  saveCodeToFile,
  getAvailableProviders
} from './ai-providers.js'
import ora from 'ora'
import chalk from 'chalk'
import logger from './logger.js'

export async function run() {
  try {
    logger.header('🌳 figtree', 'Extract design tokens from Figma')
    logger.info('Ready to extract styles from your Figma file!\n')

    // Step 1: Get file key from user
    let fileKey
    let fileInfo
    let confirmed = false

    while (!confirmed) {
      fileKey = await promptForFileKey()

      // Step 2: Validate file key and get file info
      const spinner = ora(
        'Validating file key and fetching file info...'
      ).start()

      try {
        fileInfo = await getFileInfo(fileKey)
        spinner.succeed('File found and validated!')

        // Step 3: Confirm file selection
        confirmed = await confirmFileSelection(fileInfo)

        if (!confirmed) {
          logger.info(chalk.yellow('\n🔄 Let\'s try another file key...\n'))
        }
      } catch (error) {
        spinner.fail('Failed to validate file key.')

        if (error.message.includes('Invalid Figma token')) {
          logger.error(chalk.yellow('\n🔑 Token Issue:'))
          logger.raw('Please check your Figma token setup:')
          logger.raw('1. Copy .env.example to .env')
          logger.raw(
            '2. Get your token: https://www.figma.com/developers/api#access-tokens'
          )
          logger.raw('3. Add your token to .env')
          logger.raw('4. Or use: figtree --token YOUR_TOKEN')
          throw new Error('Invalid Figma token configuration')
        } else if (error.message.includes('Network error')) {
          logger.error(chalk.yellow('\n🌐 Network Issue:'))
          logger.raw('Please check your internet connection and try again.')
          throw new Error('Network connection issue')
        } else if (error.message.includes('Resource not found')) {
          logger.error(chalk.red('\n❌ File not found:'))
          logger.raw('• Check if the file key is correct')
          logger.raw('• Make sure you have access to this file')
          logger.raw('• Verify the file exists in your Figma account')
          logger.raw(chalk.gray('\nLet\'s try again...\n'))
          continue
        } else if (error.message.includes('Access denied')) {
          logger.error(chalk.red('\n❌ Access denied:'))
          logger.raw('• You don\'t have permission to access this file')
          logger.raw('• Check if the file is in a team you\'re not part of')
          logger.raw('• Make sure your Figma token has the right permissions')
          logger.raw(chalk.gray('\nLet\'s try again...\n'))
          continue
        } else {
          logger.error(chalk.red(`\n❌ Error: ${error.message}`))
          logger.raw(chalk.gray('Let\'s try again...\n'))
          continue
        }
      }
    }

    // Step 4: Extract styles from the file
    const stylesSpinner = ora('Extracting styles from file...').start()
    let styles

    try {
      styles = await getStylesFromFile(fileKey)
      stylesSpinner.succeed('Styles extracted successfully!')

      // Show summary of extracted styles
      logger.section('📊 Styles Summary:')
      logger.info(`• ${styles.summary.fillStyles} color/fill styles`)
      logger.info(`• ${styles.summary.textStyles} text styles`)
      logger.info(`• ${styles.summary.effectStyles} effect styles`)
      logger.info(`• ${styles.summary.gridStyles} grid styles`)
      logger.info(`• Total: ${styles.summary.totalStyles} styles`)

      if (styles.summary.totalStyles === 0) {
        logger.warn(chalk.yellow('\n⚠️  No styles found in this file.'))
        logger.info('This could mean:')
        logger.info('• The file doesn\'t have any defined styles')
        logger.info('• All styles are from external libraries')
        logger.info('• The file is empty or has no design tokens')
        logger.info('\nContinuing with document-level style extraction...')
      }
    } catch (error) {
      stylesSpinner.fail('Failed to extract styles.')
      logger.error(`\n❌ Error extracting styles: ${error.message}`)

      if (error.message.includes('Access denied')) {
        logger.warn('\nThis file might be in a team you don\'t have access to.')
        logger.raw('Try a different file or check your permissions.')
      }
      throw new Error('Failed to extract styles from file')
    }

    // Step 5: Choose generation mode
    const mode = await chooseGenerationMode()

    if (mode === 'ai') {
      // AI-powered generation
      await generateWithAI(styles)
    } else {
      // Original prompt generation
      await generatePromptMode(styles)
    }
  } catch (error) {
    // Catch any unexpected errors
    if (error.message && error.message.includes('User force closed')) {
      logger.raw(chalk.gray('\n👋 Cancelled by user.'))
      throw new Error('User cancelled operation')
    } else {
      logger.error(`\n💥 Unexpected error: ${error.message}`)
      logger.raw(chalk.gray('Please try again or report this issue.'))
      throw error
    }
  }
}

// AI-powered code generation
async function generateWithAI(styles) {
  try {
    logger.section('🤖 Setting up AI code generation...')

    // Check available providers
    const availableProviders = getAvailableProviders()
    if (Object.keys(availableProviders).length === 0) {
      logger.warn(chalk.yellow('\n⚠️  No AI providers configured.'))
      logger.info('To use AI generation, set up API keys in your .env file:')
      logger.info('• OPENAI_API_KEY for OpenAI')
      logger.info('• GOOGLE_API_KEY for Google (Gemini)')
      logger.info('• ANTHROPIC_API_KEY for Anthropic (Claude)')
      logger.info('• DEEPSEEK_API_KEY for DeepSeek')
      logger.info(chalk.gray('\nFalling back to prompt generation...'))

      await generatePromptMode(styles)
      return
    }

    // Get user preferences
    const provider = await chooseAIProvider()
    const model = await chooseModel(provider)
    const format = await chooseCodeFormat()
    const outputFile = await promptForOutputFile(format)

    // Get token limits for the selected model
    const tokenLimits = {
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

    const maxTokens = tokenLimits[model] || 100_000
    logger.raw(
      chalk.blue(
        `\n📊 Model: ${model} (${maxTokens.toLocaleString()} token limit)`
      )
    )

    logger.raw(
      chalk.cyan(
        `\n🔧 Generating ${format} code using ${provider} (${model})...`
      )
    )

    const spinner = ora('Generating code with AI...').start()

    let result
    try {
      if (format === 'json') {
        // Use structured generation for JSON design tokens
        result = await generateDesignTokens(styles, {
          provider,
          model,
          maxTokens
        })
      } else {
        // Use text generation for code formats
        result = await generateCodeFromStyles(styles, {
          provider,
          model,
          format,
          maxTokens
        })
      }

      spinner.succeed('Code generated successfully!')

      // Save to file
      const savedFile = await saveCodeToFile(result, format, outputFile)

      logger.success(`\n✅ Code generated and saved to: ${savedFile}`)
      logger.info(chalk.gray('You can now use this code in your project!'))

      // Show preview of generated code
      const preview =
        typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      const previewLength = 250

      if (preview.length > previewLength) {
        logger.info(chalk.blue('\n📝 Preview (first 500 characters):'))
        logger.raw(chalk.gray(preview.substring(0, previewLength) + '...'))
      } else {
        logger.info(chalk.blue('\n📝 Generated code:'))
        logger.raw(chalk.gray(preview))
      }
    } catch (error) {
      spinner.fail('Failed to generate code')

      if (error.message.includes('Missing API key')) {
        logger.warn(chalk.yellow('\n🔑 API Key Issue:'))
        logger.error(error.message)
        logger.raw(
          'Please check your .env file and make sure the API key is set correctly.'
        )
      } else if (
        error.message.includes('rate limit') ||
        error.message.includes('quota')
      ) {
        logger.warn(chalk.yellow('\n⏱️  Rate Limit Issue:'))
        logger.info('You\'ve hit the rate limit for this provider.')
        logger.raw(
          'Please wait a moment and try again, or use a different provider.'
        )
      } else if (
        error.message.includes('token') ||
        error.message.includes('context')
      ) {
        logger.warn(chalk.yellow('\n🔢 Token Limit Issue:'))
        logger.info('Your Figma file is too large for the selected model.')
        logger.info('Try these solutions:')
        logger.raw(
          '• Use a model with higher token limits (Claude 3.5 Sonnet, Gemini 1.5 Pro)'
        )
        logger.raw('• Use prompt mode to manually split the data')
        logger.raw(
          '• The tool will automatically chunk large files when possible'
        )
      } else {
        logger.error(chalk.red(`\n❌ Generation error: ${error.message}`))
      }

      // Offer fallback to prompt mode
      logger.raw(chalk.gray('\nWould you like to generate a prompt instead?'))
      const fallback = await new Promise((resolve) => {
        import('inquirer').then(({ default: inquirer }) => {
          inquirer
            .prompt([
              {
                name: 'fallback',
                type: 'confirm',
                message: 'Generate prompt for manual use?',
                default: true
              }
            ])
            .then(({ fallback }) => resolve(fallback))
        })
      })

      if (fallback) {
        await generatePromptMode(styles)
      }
    }
  } catch (error) {
    logger.error(chalk.red(`\n💥 AI generation error: ${error.message}`))
    logger.info(chalk.gray('Falling back to prompt generation...'))
    await generatePromptMode(styles)
  }
}

// Original prompt generation mode
async function generatePromptMode(styles) {
  try {
    logger.section('\n📝 Generating prompt for manual AI use...')

    // Use same format options as AI mode
    const format = await chooseCodeFormat()

    logger.progress('\n🔧 Generating prompt...')

    const prompt = generatePrompt(styles, null, format)

    // Save to file
    const savedFile = savePromptToFile(prompt)

    // Also display in console
    logger.raw(chalk.green('\n--- GENERATED PROMPT ---\n'))
    logger.raw(prompt)
    logger.raw(chalk.green('\n--- END ---\n'))

    if (savedFile) {
      logger.success(
        chalk.blue(`\n🎉 Ready to use! Prompt saved to: ${savedFile}`)
      )
      logger.info(
        chalk.gray(
          'You can now copy this prompt and use it with your chosen LLM.\n'
        )
      )
    } else {
      logger.warn(
        chalk.yellow(
          '\n⚠️  Could not save to file, but prompt is displayed above.'
        )
      )
    }
  } catch (error) {
    logger.error(chalk.red(`\n💥 Prompt generation error: ${error.message}`))
    throw error
  }
}
