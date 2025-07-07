import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { deepseek } from '@ai-sdk/deepseek'
import { generateText, generateObject } from 'ai'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import logger from './logger.js'

// Provider configuration
const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: {
      'o4-mini': 'o4 Mini - Faster and more affordable model',
      o3: 'o3 - Most powerful model',
      'o3-pro': 'o3 Pro - More compute than o3 for better responses',
      'o3-mini': 'o3 Mini - Smaller than o3',
      o1: 'o1 - Most powerful model',
      'o1-pro': 'o1 Pro - More compute than o1 for better responses'
    },
    factory: openai,
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'o4-mini'
  },
  google: {
    name: 'Google (Gemini)',
    models: {
      'gemini-2.5-pro': 'Gemini 2.5 Pro - Enhanced thinking and reasoning',
      'gemini-2.5-flash':
        'Gemini 2.5 Flash - Adaptive thinking, cost efficient'
    },
    factory: google,
    envVar: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-2.5-flash'
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: {
      'claude-opus-4-20250514':
        'Claude Opus 4 - Most powerful and capable model',
      'claude-sonnet-4-20250514': 'Claude Sonnet 4 - High performance model'
    },
    factory: anthropic,
    envVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514'
  },
  deepseek: {
    name: 'DeepSeek',
    models: {
      'deepseek-chat': 'Most powerful and capable model',
      'deepseek-reasoner': 'High performance model'
    },
    factory: deepseek,
    envVar: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat'
  }
}

// Get available providers (only those with API keys)
export function getAvailableProviders() {
  const available = {}

  for (const [key, config] of Object.entries(AI_PROVIDERS)) {
    if (process.env[config.envVar]) {
      available[key] = config
    }
  }

  return available
}

// Check if any providers are available
export function hasAvailableProviders() {
  return Object.keys(getAvailableProviders()).length > 0
}

// Create model instance
export function createModel(provider, modelId) {
  const config = AI_PROVIDERS[provider]
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`)
  }

  if (!process.env[config.envVar]) {
    throw new Error(
      `Missing API key for ${config.name}. Please set ${config.envVar} in your .env file.`
    )
  }

  return config.factory(modelId || config.defaultModel)
}

// Count approximate tokens (rough estimate: 1 token ≈ 4 characters)
function countTokens(text) {
  return Math.ceil(text.length / 4)
}

// Check if styles need chunking based on token limits
function shouldChunkStyles(compressedStyles, maxTokens = 100000) {
  const estimatedTokens = countTokens(JSON.stringify(compressedStyles))
  return estimatedTokens > maxTokens
}

// Split styles into chunks for processing
function chunkStyles(styles, maxTokensPerChunk = 80000) {
  const compressed = compressStylesForAI(styles)
  const chunks = []

  // If small enough, return as single chunk
  if (!shouldChunkStyles(compressed, maxTokensPerChunk)) {
    return [compressed]
  }

  // Split by category if needed
  const categories = ['colors', 'typography', 'effects', 'spacing']
  let currentChunk = { colors: [], typography: [], effects: [], spacing: [] }

  for (const category of categories) {
    const items = compressed[category] || []

    for (const item of items) {
      currentChunk[category].push(item)

      // Check if chunk is getting too large
      if (countTokens(JSON.stringify(currentChunk)) > maxTokensPerChunk) {
        // Remove the last item and save chunk
        currentChunk[category].pop()

        // Add summary to chunk
        currentChunk.summary = {
          totalColors: currentChunk.colors.length,
          totalTypography: currentChunk.typography.length,
          totalEffects: currentChunk.effects.length,
          totalSpacing: currentChunk.spacing.length,
          chunkNumber: chunks.length + 1
        }

        chunks.push(currentChunk)

        // Start new chunk with the item that didn't fit
        currentChunk = { colors: [], typography: [], effects: [], spacing: [] }
        currentChunk[category] = [item]
      }
    }
  }

  // Add remaining items as final chunk
  if (Object.values(currentChunk).some((arr) => arr.length > 0)) {
    currentChunk.summary = {
      totalColors: currentChunk.colors.length,
      totalTypography: currentChunk.typography.length,
      totalEffects: currentChunk.effects.length,
      totalSpacing: currentChunk.spacing.length,
      chunkNumber: chunks.length + 1
    }
    chunks.push(currentChunk)
  }

  return chunks
}

// Generate code from styles with chunking support
export async function generateCodeFromStyles(styles, options = {}) {
  const {
    provider = 'openai',
    model,
    format = 'css',
    temperature = 0.3,
    maxTokens = 100000
  } = options

  const aiModel = createModel(provider, model)
  const compressed = compressStylesForAI(styles)
  const estimatedTokens = countTokens(JSON.stringify(compressed))

  logger.debug(
    `[figtree] Estimated tokens: ${estimatedTokens.toLocaleString()}`
  )

  // Check if we need to chunk
  if (shouldChunkStyles(compressed, maxTokens)) {
    logger.warn(
      `[figtree] File is large (${estimatedTokens.toLocaleString()} tokens), splitting into chunks...`
    )

    const chunks = chunkStyles(styles, maxTokens * 0.8) // Use 80% of limit for safety
    const results = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      logger.progress(
        `[figtree] Processing chunk ${i + 1}/${chunks.length}...`
      )

      const prompt = createChunkPrompt(chunk, format, i + 1, chunks.length)

      try {
        const { text } = await generateText({
          model: aiModel,
          prompt,
          temperature
        })

        results.push(text)
      } catch (error) {
        logger.error(chalk.red(`[figtree] Error processing chunk ${i + 1}:`), {
          error: error.message
        })
        throw error
      }
    }

    // Combine chunks
    return combineChunkedResults(results, format)
  } else {
    // Process normally
    const prompt = createPrompt(styles, format)

    try {
      const { text } = await generateText({
        model: aiModel,
        prompt,
        temperature
      })

      return text
    } catch (error) {
      logger.error(
        chalk.red(`[figtree] Error generating code with ${provider}:`),
        { error: error.message }
      )
      throw error
    }
  }
}

// Create prompt for individual chunks
function createChunkPrompt(chunk, format, chunkNumber, totalChunks) {
  const stylesSummary = JSON.stringify(chunk, null, 2)

  // Get comment format for the target language
  let commentFormat = '// comment'
  switch (format) {
    case 'css':
    case 'scss':
    case 'css-variables':
      commentFormat = '/* comment */'
      break
    case 'tailwind':
    case 'javascript':
      commentFormat = '// comment'
      break
    case 'json':
      commentFormat = 'N/A - no comments in JSON'
      break
    case 'android':
      commentFormat = '<!-- comment -->'
      break
    case 'swiftui':
      commentFormat = '// comment'
      break
    default:
      commentFormat = '// comment'
  }

  const basePrompt = `CRITICAL: Return ONLY valid ${format} code. No explanations, no markdown, no text outside of code.

This is chunk ${chunkNumber} of ${totalChunks} from a large design system.

Convert these Figma design tokens to ${format} code:

${stylesSummary}

OUTPUT RULES:
- Return ONLY valid ${format} code
- NO explanations or descriptions outside of code
- NO markdown formatting, NO backticks
- NO "Here's the code:" or similar text
- All commentary must be in valid ${format} comments using: ${commentFormat}
- Start immediately with the code`

  // Add chunk-specific instructions
  const chunkInstructions =
    totalChunks > 1
      ? `- Generate code for this chunk only
- Use consistent naming that will work with other chunks
- Add comments indicating this is part ${chunkNumber} of ${totalChunks}
- `
      : ''

  switch (format) {
    case 'css':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Use CSS custom properties (--variable-name) for colors
- Create utility classes for typography
- Use /* comment */ for all explanations
- Use modern CSS syntax with good browser support
- Group related styles with /* section comments */
- Use semantic naming conventions
- NO explanatory text outside of CSS comments`

    case 'scss':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Use SCSS variables ($variable-name) for colors
- Create mixins for typography styles
- Use /* comment */ and // comment for all explanations
- Use SCSS best practices and features
- Group related styles with /* section comments */
- Use semantic naming conventions
- NO explanatory text outside of SCSS comments`

    case 'tailwind':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Create a partial tailwind.config.js configuration
- Include colors, typography, spacing, and effects from this chunk
- Follow Tailwind CSS naming conventions
- Include proper theme structure
- Use // comment for all explanations
- Use semantic naming that matches the design system
- Start with module.exports = { or export default {
- NO explanatory text outside of JavaScript comments`

    case 'javascript':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Export as ES modules with proper TypeScript types
- Use descriptive variable names
- Use // comment or /* comment */ for all explanations
- Organize into logical groups (colors, typography, etc.)
- Use proper JavaScript object structure
- Include JSDoc comments for documentation
- NO explanatory text outside of JavaScript comments`

    case 'json':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Create a clean JSON structure
- Organize by type (colors, typography, spacing, effects)
- Use descriptive names and include descriptions as JSON values
- Follow design token standards
- Include proper nesting and organization
- Valid JSON only - no comments possible
- NO explanatory text outside of the JSON structure`

    case 'css-variables':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Generate ONLY CSS custom properties
- Use semantic naming (--color-primary, --font-heading, etc.)
- Include proper fallbacks
- Group by category with /* section comments */
- Use consistent naming patterns
- Use /* comment */ for all explanations
- NO explanatory text outside of CSS comments`

    case 'android':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Create proper Android XML resource files
- Use dp units for spacing and sp for text sizes
- Follow Android naming conventions (lowercase with underscores)
- Create separate sections for colors, dimensions, and styles
- Use <!-- comment --> for all explanations
- NO explanatory text outside of XML comments`

    case 'swiftui':
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Create Swift extensions for Color and Font
- Use SwiftUI's design token patterns
- Implement semantic color schemes
- Create reusable typography styles
- Use // comment for all explanations
- Support dynamic type and accessibility
- NO explanatory text outside of Swift comments`

    default:
      return `${basePrompt}

REQUIREMENTS:
${chunkInstructions}- Follow best practices for ${format}
- Use semantic naming conventions
- Include proper documentation in ${commentFormat} format
- Organize code logically
- NO explanatory text outside of valid ${format} comments`
  }
}

// Combine results from multiple chunks
function combineChunkedResults(results, format) {
  const header = `/* Design tokens generated from Figma - Combined from ${results.length} chunks */\n\n`

  switch (format) {
    case 'css':
    case 'scss':
    case 'css-variables':
      return header + results.join('\n\n/* --- Next chunk --- */\n\n')

    case 'tailwind':
      // For Tailwind, we need to merge the config objects
      try {
        const configs = results.map((r) => {
          // Extract the config object from the code
          const configMatch = r.match(/module\.exports\s*=\s*({[\s\S]*})/)
          if (configMatch) {
            return configMatch[1]
          }
          return r
        })

        return `${header}module.exports = {\n  theme: {\n    extend: {\n      // Combined from ${
          results.length
        } chunks\n      ${configs.join(',\n      ')}\n    }\n  }\n}`
      } catch (error) {
        return header + results.join('\n\n// --- Next chunk ---\n\n')
      }

    case 'javascript':
      return header + results.join('\n\n// --- Next chunk ---\n\n')

    case 'json':
      // For JSON, try to merge objects
      try {
        const merged = {}
        results.forEach((result, index) => {
          try {
            const parsed = JSON.parse(result)
            Object.assign(merged, parsed)
          } catch (error) {
            merged[`chunk_${index + 1}`] = result
          }
        })
        return JSON.stringify(merged, null, 2)
      } catch (error) {
        return header + results.join('\n\n// --- Next chunk ---\n\n')
      }

    default:
      return header + results.join('\n\n// --- Next chunk ---\n\n')
  }
}

// Generate structured design tokens
export async function generateDesignTokens(styles, options = {}) {
  const { provider = 'openai', model } = options

  const aiModel = createModel(provider, model)

  // Define the schema for design tokens
  const tokenSchema = z.object({
    colors: z.record(
      z.object({
        value: z.string(),
        type: z.literal('color'),
        description: z.string().optional()
      })
    ),
    typography: z.record(
      z.object({
        value: z.object({
          fontFamily: z.string(),
          fontSize: z.string(),
          fontWeight: z.string(),
          lineHeight: z.string().optional()
        }),
        type: z.literal('typography'),
        description: z.string().optional()
      })
    ),
    spacing: z
      .record(
        z.object({
          value: z.string(),
          type: z.literal('spacing'),
          description: z.string().optional()
        })
      )
      .optional(),
    effects: z
      .record(
        z.object({
          value: z.string(),
          type: z.literal('effect'),
          description: z.string().optional()
        })
      )
      .optional()
  })

  try {
    const { object } = await generateObject({
      model: aiModel,
      schema: tokenSchema,
      prompt: createTokenPrompt(styles)
    })

    return object
  } catch (error) {
    logger.error(
      chalk.red(`[figtree] Error generating tokens with ${provider}:`),
      { error: error.message }
    )
    throw error
  }
}

// Compress styles data to reduce token usage
function compressStylesForAI(styles) {
  const compressed = {
    colors: [],
    typography: [],
    effects: [],
    spacing: []
  }

  // Extract detailed paint/color information
  if (styles.styles?.fill) {
    compressed.colors = styles.styles.fill
      .map((style) => {
        const paint = {
          name: style.name,
          type: style.values?.type || 'unknown'
        }

        // Common properties for all paint types
        if (style.values?.opacity !== undefined) {
          paint.opacity = style.values.opacity
        }
        if (style.values?.blendMode) paint.blendMode = style.values.blendMode

        // SOLID paint properties
        if (style.values?.type === 'SOLID') {
          if (style.values?.color) paint.color = style.values.color
          if (style.values?.hex) paint.hex = style.values.hex
          if (style.values?.css) paint.css = style.values.css
        }

        // GRADIENT paint properties (LINEAR, RADIAL, ANGULAR, DIAMOND)
        if (style.values?.type?.startsWith('GRADIENT_')) {
          if (style.values?.gradientHandlePositions) {
            paint.gradientHandlePositions =
              style.values.gradientHandlePositions
          }
          if (style.values?.gradientStops) {
            paint.gradientStops = style.values.gradientStops
          }
          if (style.values?.gradient) paint.gradient = style.values.gradient // Fallback if API uses different structure
        }

        // IMAGE paint properties
        if (style.values?.type === 'IMAGE') {
          if (style.values?.scaleMode) paint.scaleMode = style.values.scaleMode
          if (style.values?.imageTransform) {
            paint.imageTransform = style.values.imageTransform
          }
          if (style.values?.scalingFactor !== undefined) {
            paint.scalingFactor = style.values.scalingFactor
          }
          if (style.values?.rotation !== undefined) {
            paint.rotation = style.values.rotation
          }
          if (style.values?.imageRef) paint.imageRef = style.values.imageRef
          if (style.values?.filters) paint.filters = style.values.filters
          if (style.values?.gifRef) paint.gifRef = style.values.gifRef
        }

        // PATTERN paint properties (beta)
        if (style.values?.type === 'PATTERN') {
          if (style.values?.sourceNodeId) {
            paint.sourceNodeId = style.values.sourceNodeId
          }
          if (style.values?.tileType) paint.tileType = style.values.tileType
          if (style.values?.scalingFactor !== undefined) {
            paint.scalingFactor = style.values.scalingFactor
          }
          if (style.values?.spacing) paint.spacing = style.values.spacing
          if (style.values?.horizontalAlignment) {
            paint.horizontalAlignment = style.values.horizontalAlignment
          }
          if (style.values?.verticalAlignment) {
            paint.verticalAlignment = style.values.verticalAlignment
          }
        }

        // Fallback to any available color representation
        if (!paint.color && !paint.gradientStops && !paint.imageRef) {
          if (style.values?.hex) paint.fallbackHex = style.values.hex
          if (style.values?.css) paint.fallbackCss = style.values.css
        }

        return paint
      })
      .filter(
        (paint) =>
          paint.type !== 'unknown' || paint.fallbackHex || paint.fallbackCss
      )
  }

  // Extract only essential typography information
  if (styles.styles?.text) {
    compressed.typography = styles.styles.text.map((style) => ({
      name: style.name,
      fontSize: style.values?.fontSize || 16,
      fontFamily: style.values?.fontFamily || 'system',
      fontWeight: style.values?.fontWeight || 'normal',
      lineHeight: style.values?.lineHeight || 'normal',
      letterSpacing: style.values?.letterSpacing || 'normal'
    }))
  }

  // Extract detailed effect information
  if (styles.styles?.effect) {
    compressed.effects = styles.styles.effect
      .map((style) => {
        // Effects are stored in style.values.effects array
        if (
          !style.values?.effects ||
          !Array.isArray(style.values.effects) ||
          style.values.effects.length === 0
        ) {
          return null
        }

        // Take the first effect from the array (most Figma styles have one effect)
        const effectData = style.values.effects[0]
        const effect = {
          name: style.name,
          type: effectData.type || 'unknown'
        }

        // Add common properties
        if (effectData.radius !== undefined) effect.radius = effectData.radius
        if (effectData.blendMode) effect.blendMode = effectData.blendMode
        if (effectData.visible !== undefined) {
          effect.visible = effectData.visible
        }

        // Shadow-specific properties (INNER_SHADOW, DROP_SHADOW)
        if (
          effectData.type === 'INNER_SHADOW' ||
          effectData.type === 'DROP_SHADOW'
        ) {
          if (effectData.color) effect.color = effectData.color
          if (effectData.offset) effect.offset = effectData.offset
          if (effectData.spread !== undefined) {
            effect.spread = effectData.spread
          }
          if (effectData.showShadowBehindNode !== undefined) {
            effect.showShadowBehindNode = effectData.showShadowBehindNode
          }
        }

        // Blur-specific properties (LAYER_BLUR, BACKGROUND_BLUR)
        if (
          effectData.type === 'LAYER_BLUR' ||
          effectData.type === 'BACKGROUND_BLUR'
        ) {
          if (effectData.blurType) effect.blurType = effectData.blurType
          if (effectData.startRadius !== undefined) {
            effect.startRadius = effectData.startRadius
          }
          if (effectData.startOffset) {
            effect.startOffset = effectData.startOffset
          }
          if (effectData.endOffset) effect.endOffset = effectData.endOffset
        }

        // Noise-specific properties
        if (effectData.type === 'NOISE') {
          if (effectData.noiseSize !== undefined) {
            effect.noiseSize = effectData.noiseSize
          }
          if (effectData.noiseType) effect.noiseType = effectData.noiseType
          if (effectData.density !== undefined) {
            effect.density = effectData.density
          }
          if (effectData.secondaryColor) {
            effect.secondaryColor = effectData.secondaryColor
          }
          if (effectData.opacity !== undefined) {
            effect.opacity = effectData.opacity
          }
        }

        // Texture-specific properties
        if (effectData.type === 'TEXTURE') {
          if (effectData.noiseSize !== undefined) {
            effect.noiseSize = effectData.noiseSize
          }
          if (effectData.clipToShape !== undefined) {
            effect.clipToShape = effectData.clipToShape
          }
        }

        // Include all effects from the array if there are multiple
        if (style.values.effects.length > 1) {
          effect.allEffects = style.values.effects
        }

        return effect
      })
      .filter((effect) => effect !== null && effect.type !== 'unknown')
  }

  // Extract grid/layout information
  if (styles.styles?.grid) {
    compressed.spacing = styles.styles.grid
      .map((style) => {
        const grid = {
          name: style.name,
          type: 'grid'
        }

        // Extract grid properties
        if (style.values?.grids && style.values.grids.length > 0) {
          const gridData = style.values.grids[0] // Take first grid
          if (gridData.pattern) grid.pattern = gridData.pattern
          if (gridData.sectionSize !== undefined) {
            grid.sectionSize = gridData.sectionSize
          }
          if (gridData.gutterSize !== undefined) {
            grid.gutterSize = gridData.gutterSize
          }
          if (gridData.offset !== undefined) grid.offset = gridData.offset
          if (gridData.count !== undefined) grid.count = gridData.count
          if (gridData.alignment) grid.alignment = gridData.alignment
          if (gridData.color) grid.color = gridData.color
        }

        return grid
      })
      .filter((grid) => grid.pattern || grid.sectionSize !== undefined)
  }

  // Add summary stats
  compressed.summary = {
    totalColors: compressed.colors.length,
    totalTypography: compressed.typography.length,
    totalEffects: compressed.effects.length,
    totalSpacing: compressed.spacing.length,
    originalFileSize: JSON.stringify(styles).length
  }

  return compressed
}

// Create prompt for code generation
function createPrompt(styles, format) {
  // Use compressed styles instead of full object
  const compressedStyles = compressStylesForAI(styles)
  const stylesSummary = JSON.stringify(compressedStyles, null, 2)

  logger.tokenUsage(
    Math.round(JSON.stringify(styles).length / 4),
    Math.round(stylesSummary.length / 4),
    'Code generation'
  )

  // Get comment format for the target language
  let commentFormat = '// comment'
  switch (format) {
    case 'css':
    case 'scss':
    case 'css-variables':
      commentFormat = '/* comment */'
      break
    case 'tailwind':
    case 'javascript':
      commentFormat = '// comment'
      break
    case 'json':
      commentFormat = 'N/A - no comments in JSON'
      break
    case 'android':
      commentFormat = '<!-- comment -->'
      break
    case 'swiftui':
      commentFormat = '// comment'
      break
    default:
      commentFormat = '// comment'
  }

  const basePrompt = `CRITICAL: Return ONLY valid ${format} code. No explanations, no markdown, no text outside of code.

Convert these Figma design tokens to ${format} code:

${stylesSummary}

OUTPUT RULES:
- Return ONLY valid ${format} code
- NO explanations or descriptions outside of code
- NO markdown formatting, NO backticks
- NO "Here's the code:" or similar text
- All commentary must be in valid ${format} comments using: ${commentFormat}
- Start immediately with the code`

  switch (format) {
    case 'css':
      return `${basePrompt}

REQUIREMENTS:
- Use CSS custom properties (--variable-name) for colors
- Create utility classes for typography
- Use /* comment */ for all explanations
- Use modern CSS syntax with good browser support
- Group related styles with /* section comments */
- Use semantic naming conventions
- NO explanatory text outside of CSS comments`

    case 'scss':
      return `${basePrompt}

REQUIREMENTS:
- Use SCSS variables ($variable-name) for colors
- Create mixins for typography styles
- Use /* comment */ and // comment for all explanations
- Use SCSS best practices and features
- Group related styles with /* section comments */
- Use semantic naming conventions
- NO explanatory text outside of SCSS comments`

    case 'tailwind':
      return `${basePrompt}

REQUIREMENTS:
- Create a complete tailwind.config.js configuration
- Include colors, typography, spacing, and effects
- Follow Tailwind CSS naming conventions
- Include proper theme structure
- Use // comment for all explanations
- Use semantic naming that matches the design system
- Start with module.exports = { or export default {
- NO explanatory text outside of JavaScript comments`

    case 'javascript':
      return `${basePrompt}

REQUIREMENTS:
- Export as ES modules with proper TypeScript types
- Use descriptive variable names
- Use // comment or /* comment */ for all explanations
- Organize into logical groups (colors, typography, etc.)
- Use proper JavaScript object structure
- Include JSDoc comments for documentation
- NO explanatory text outside of JavaScript comments`

    case 'json':
      return `${basePrompt}

REQUIREMENTS:
- Create a clean JSON structure
- Organize by type (colors, typography, spacing, effects)
- Use descriptive names and include descriptions as JSON values
- Follow design token standards
- Include proper nesting and organization
- Valid JSON only - no comments possible
- NO explanatory text outside of the JSON structure`

    case 'css-variables':
      return `${basePrompt}

REQUIREMENTS:
- Generate ONLY CSS custom properties
- Use semantic naming (--color-primary, --font-heading, etc.)
- Include proper fallbacks
- Group by category with /* section comments */
- Use consistent naming patterns
- Use /* comment */ for all explanations
- NO explanatory text outside of CSS comments`

    case 'android':
      return `${basePrompt}

REQUIREMENTS:
- Create proper Android XML resource files
- Use dp units for spacing and sp for text sizes
- Follow Android naming conventions (lowercase with underscores)
- Create separate sections for colors, dimensions, and styles
- Use <!-- comment --> for all explanations
- NO explanatory text outside of XML comments`

    case 'swiftui':
      return `${basePrompt}

REQUIREMENTS:
- Create Swift extensions for Color and Font
- Use SwiftUI's design token patterns
- Implement semantic color schemes
- Create reusable typography styles
- Use // comment for all explanations
- Support dynamic type and accessibility
- NO explanatory text outside of Swift comments`

    default:
      return `${basePrompt}

REQUIREMENTS:
- Follow best practices for ${format}
- Use semantic naming conventions
- Include proper documentation in ${commentFormat} format
- Organize code logically
- NO explanatory text outside of valid ${format} comments`
  }
}

// Create prompt for design token generation
function createTokenPrompt(styles) {
  // Use compressed styles for token generation as well
  const compressedStyles = compressStylesForAI(styles)
  const stylesSummary = JSON.stringify(compressedStyles, null, 2)

  logger.tokenUsage(
    Math.round(JSON.stringify(styles).length / 4),
    Math.round(stylesSummary.length / 4),
    'Token generation'
  )

  return `CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no text outside of JSON.

Convert these Figma styles into a comprehensive design token system following design token standards:

${stylesSummary}

OUTPUT RULES:
- Return ONLY valid JSON
- NO explanations or descriptions outside of JSON
- NO markdown formatting, NO backticks
- NO "Here's the JSON:" or similar text
- Start immediately with the JSON object

REQUIREMENTS:
- Create a well-structured design token system
- Color tokens from fill styles with proper semantic names
- Typography tokens from text styles with complete font information
- Spacing tokens if available
- Effect tokens for shadows and other effects
- Proper naming conventions (kebab-case)
- Meaningful descriptions for each token as JSON values
- Organized grouping by category
- Focus on creating a maintainable and scalable design system`
}

// Save generated code to file
export async function saveCodeToFile(code, format, filename) {
  const extensions = {
    css: 'css',
    scss: 'scss',
    tailwind: 'js',
    javascript: 'js',
    json: 'json',
    'css-variables': 'css',
    android: 'xml',
    swiftui: 'swift'
  }

  const extension = extensions[format] || 'txt'
  const outputFile = filename || `figma-styles.${extension}`

  try {
    // Create output directory if it doesn't exist
    const dir = path.dirname(outputFile)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Format the code based on type
    let formattedCode = code
    if (format === 'json' || typeof code === 'object') {
      formattedCode = JSON.stringify(code, null, 2)
    }

    await fs.promises.writeFile(outputFile, formattedCode, 'utf8')
    return outputFile
  } catch (error) {
    logger.error(chalk.red('[figtree] Error saving code to file:'), {
      error: error.message
    })
    throw error
  }
}

// List available models for a provider
export function getProviderModels(provider) {
  const config = AI_PROVIDERS[provider]
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`)
  }

  return config.models
}

// Get provider info
export function getProviderInfo(provider) {
  return AI_PROVIDERS[provider]
}

// Get all provider names
export function getAllProviders() {
  return AI_PROVIDERS
}
