import fs from 'fs'
import logger from './logger.js'

// Compress styles data to reduce token usage (copied from ai-providers.js)
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

export function generatePrompt(styleTree, llm, format) {
  // Use compressed styles instead of full object
  const compressedStyles = compressStylesForAI(styleTree)
  const stylesSummary = JSON.stringify(compressedStyles, null, 2)

  // Estimate token usage
  const originalTokens = Math.round(JSON.stringify(styleTree).length / 4)
  const compressedTokens = Math.round(stylesSummary.length / 4)

  logger.tokenUsage(originalTokens, compressedTokens, 'Manual mode')

  // Get comment format for the target language
  let commentFormat = '// comment'
  switch (format) {
    case 'css':
    case 'scss':
    case 'css-variables':
      commentFormat = '/* comment */'
      break
    case 'javascript':
    case 'tailwind':
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

  const llmText = llm ? ` using ${llm}` : ''
  const prompt = `CRITICAL: Return ONLY valid ${format} code. No explanations, no markdown, no text outside of code.

You are a code generation expert${llmText}.

Convert these Figma design tokens to ${format} code:

${stylesSummary}

OUTPUT RULES:
- Return ONLY valid ${format} code
- NO explanations or descriptions outside of code
- NO markdown formatting, NO backticks
- NO "Here's the code:" or similar text
- All commentary must be in valid ${format} comments using: ${commentFormat}
- Start immediately with the code

REQUIREMENTS:
${getFormatSpecificGuidelines(format)}`

  return prompt
}

export function savePromptToFile(prompt, filename) {
  // Use filename from CLI args if provided, otherwise use default
  const outputFile =
    filename || process.env.FIGTREE_OUTPUT || './figtree-prompt.txt'

  try {
    fs.writeFileSync(outputFile, prompt, 'utf8')
    logger.fileOperation('write', outputFile, 'success')
    return outputFile
  } catch (error) {
    logger.error(`❌ Error saving prompt to file: ${error.message}`)
    return null
  }
}

function getFormatSpecificGuidelines(format) {
  const guidelines = {
    css: `
- Use CSS custom properties (--variable-name) for colors
- Create utility classes for typography
- Use /* comment */ for all explanations
- Use modern CSS syntax with good browser support
- Group related styles with /* section comments */
- Use semantic naming conventions
- NO explanatory text outside of CSS comments`,

    scss: `
- Use SCSS variables ($variable-name) for colors
- Create mixins for typography styles
- Use /* comment */ and // comment for all explanations
- Use SCSS best practices and features
- Group related styles with /* section comments */
- Use semantic naming conventions
- NO explanatory text outside of SCSS comments`,

    tailwind: `
- Create a complete tailwind.config.js configuration
- Include colors, typography, spacing, and effects
- Follow Tailwind CSS naming conventions
- Include proper theme structure
- Use // comment for all explanations
- Use semantic naming that matches the design system
- Start with module.exports = { or export default {
- NO explanatory text outside of JavaScript comments`,

    javascript: `
- Export as ES modules with proper TypeScript types
- Use descriptive variable names
- Use // comment or /* comment */ for all explanations
- Organize into logical groups (colors, typography, etc.)
- Use proper JavaScript object structure
- Include JSDoc comments for documentation
- NO explanatory text outside of JavaScript comments`,

    json: `
- Create a clean JSON structure
- Organize by type (colors, typography, spacing, effects)
- Use descriptive names and include descriptions as JSON values
- Follow design token standards
- Include proper nesting and organization
- Valid JSON only - no comments possible
- NO explanatory text outside of the JSON structure`,

    'css-variables': `
- Generate ONLY CSS custom properties
- Use semantic naming (--color-primary, --font-heading, etc.)
- Include proper fallbacks
- Group by category with /* section comments */
- Use consistent naming patterns
- Use /* comment */ for all explanations
- NO explanatory text outside of CSS comments`,

    android: `
- Create proper Android XML resource files
- Use dp units for spacing and sp for text sizes
- Follow Android naming conventions (lowercase with underscores)
- Create separate sections for colors, dimensions, and styles
- Use <!-- comment --> for all explanations
- NO explanatory text outside of XML comments`,

    swiftui: `
- Create Swift extensions for Color and Font
- Use SwiftUI's design token patterns
- Implement semantic color schemes
- Create reusable typography styles
- Use // comment for all explanations
- Support dynamic type and accessibility
- NO explanatory text outside of Swift comments`
  }

  return (
    guidelines[format] ||
    `Follow best practices for ${format}
- Use semantic naming conventions
- Include proper documentation in valid ${format} comments
- Organize code logically
- NO explanatory text outside of valid ${format} comments`
  )
}
