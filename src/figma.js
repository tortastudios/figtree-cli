// src/figma.js
import { getFigmaToken } from './config.js'
import logger from './logger.js'

const BASE_URL = 'https://api.figma.com/v1'

async function fetchFromFigma(path, retries = 3) {
  const token = getFigmaToken()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
          'X-Figma-Token': token,
          'Content-Type': 'application/json'
        }
      })

      if (!res.ok) {
        const errorText = await res.text()

        // Handle specific error cases
        if (res.status === 401) {
          throw new Error(
            'Invalid Figma token. Please check your FIGMA_TOKEN in .env file.'
          )
        } else if (res.status === 403) {
          throw new Error(
            'Access denied. Please check your Figma token permissions.'
          )
        } else if (res.status === 404) {
          throw new Error(
            `Resource not found: ${path}. The file or endpoint may not exist.`
          )
        } else if (res.status === 429) {
          // Rate limited - wait and retry
          if (attempt < retries) {
            logger.warn(
              `⚠️  Rate limited. Waiting 60 seconds before retry (attempt ${attempt}/${retries})...`
            )
            await new Promise((resolve) => setTimeout(resolve, 60000))
            continue
          } else {
            throw new Error('Rate limit exceeded. Please try again later.')
          }
        } else if (res.status >= 500) {
          // Server error - retry
          if (attempt < retries) {
            logger.warn(
              `⚠️  Server error (${res.status}). Retrying in 5 seconds (attempt ${attempt}/${retries})...`
            )
            await new Promise((resolve) => setTimeout(resolve, 5000))
            continue
          } else {
            throw new Error(`Figma server error (${res.status}): ${errorText}`)
          }
        } else {
          throw new Error(`Figma API error (${res.status}): ${errorText}`)
        }
      }

      return res.json()
    } catch (error) {
      if (attempt === retries) {
        // Add network-specific error handling
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error(
            'Network error: Unable to connect to Figma API. Please check your internet connection.'
          )
        }
        throw error
      }

      // Network error - retry
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        logger.warn(
          `⚠️  Network error. Retrying in 3 seconds (attempt ${attempt}/${retries})...`
        )
        await new Promise((resolve) => setTimeout(resolve, 3000))
        continue
      }

      throw error
    }
  }
}

export async function getUserFiles() {
  logger.info(
    '[figtree] Please provide a Figma file key to extract styles from.'
  )
  logger.info('[figtree] You can find the file key in your Figma URL:')
  logger.info('[figtree] https://www.figma.com/design/FILE_KEY/File-Name')
  logger.info(
    '[figtree] Example: For URL https://www.figma.com/design/FVt1g2IuPzKJeQu8QlIGlA/Breathe-Right'
  )
  logger.info('[figtree] The file key would be: FVt1g2IuPzKJeQu8QlIGlA')

  // For now, return an empty array - the UI should handle file key input
  return []
}

// Function removed - now handled in prompts.js

// Validate file key format
export function validateFileKey(fileKey) {
  if (!fileKey || typeof fileKey !== 'string') {
    return false
  }
  // Figma file keys are alphanumeric strings, typically 22 characters
  const fileKeyRegex = /^[a-zA-Z0-9]+$/
  return fileKeyRegex.test(fileKey.trim()) && fileKey.trim().length > 10
}

export async function getFileInfo(fileKey) {
  if (!validateFileKey(fileKey)) {
    throw new Error('Invalid file key format')
  }

  logger.debug(`[figtree] Getting file info for: ${fileKey}`)

  const data = await fetchFromFigma(`/files/${fileKey}`)

  return {
    name: data.name,
    key: fileKey,
    lastModified: data.lastModified,
    thumbnailUrl: data.thumbnailUrl,
    version: data.version,
    document: data.document
  }
}

export async function getStylesFromFile(fileKey) {
  if (!validateFileKey(fileKey)) {
    throw new Error('Invalid file key format')
  }

  logger.debug(`[figtree] Fetching styles from file: ${fileKey}`)

  try {
    // Get file data using Files API
    const fileData = await fetchFromFigma(`/files/${fileKey}`)
    logger.debug(`[figtree] File data retrieved for ${fileKey}`)

    // Extract and organize styles from file data
    const extractedStyles = {
      fileInfo: {
        name: fileData.name,
        key: fileKey,
        lastModified: fileData.lastModified,
        version: fileData.version
      },
      styles: {
        fill: [],
        text: [],
        effect: [],
        grid: []
      },
      raw: {
        file: fileData
      }
    }

    // Process styles from the file data (they're in fileData.styles)
    if (fileData.styles && Object.keys(fileData.styles).length > 0) {
      logger.debug(
        `[figtree] Found ${Object.keys(fileData.styles).length} styles in file`
      )

      // Extract style node IDs for the second API call
      const styleNodeIds = Object.keys(fileData.styles)

      // Fetch actual style definitions using nodes API
      const nodesUrl = `/files/${fileKey}/nodes?ids=${styleNodeIds.join(',')}`

      const nodesData = await fetchFromFigma(nodesUrl)
      logger.debug('[figtree] Style definitions retrieved')

      // Process each style with its full definition
      for (const [styleId, styleInfo] of Object.entries(fileData.styles)) {
        const styleNode = nodesData.nodes[styleId]

        const style = {
          id: styleId,
          name: styleInfo.name,
          description: styleInfo.description,
          key: styleInfo.key,
          styleType: styleInfo.styleType,
          remote: styleInfo.remote,
          // Add the actual style values from the nodes data
          definition: styleNode?.document || null
        }

        // Parse actual values based on style type
        if (styleNode?.document) {
          switch (styleInfo.styleType) {
            case 'FILL':
              style.values = parseFillStyle(styleNode.document)
              extractedStyles.styles.fill.push(style)
              break
            case 'TEXT':
              style.values = parseTextStyle(styleNode.document)
              extractedStyles.styles.text.push(style)
              break
            case 'EFFECT':
              style.values = parseEffectStyle(styleNode.document)
              extractedStyles.styles.effect.push(style)
              break
            case 'GRID':
              style.values = parseGridStyle(styleNode.document)
              extractedStyles.styles.grid.push(style)
              break
          }
        } else {
          logger.warn(
            `[figtree] Warning: No definition found for style ${styleId} (${styleInfo.name})`
          )
        }
      }
    } else {
      logger.info('[figtree] No styles found in file data')
    }

    // Also extract styles from the document structure for additional context
    if (fileData.document && fileData.document.children) {
      const documentStyles = extractStylesFromDocument(fileData.document)
      extractedStyles.documentStyles = documentStyles
    }

    // Add summary
    extractedStyles.summary = {
      totalStyles: Object.keys(fileData.styles || {}).length,
      fillStyles: extractedStyles.styles.fill.length,
      textStyles: extractedStyles.styles.text.length,
      effectStyles: extractedStyles.styles.effect.length,
      gridStyles: extractedStyles.styles.grid.length
    }

    return extractedStyles
  } catch (error) {
    logger.error(`[figtree] Error fetching styles from file ${fileKey}:`, {
      error
    })
    throw error
  }
}

// Helper functions to parse different style types
function parseFillStyle(document) {
  const values = {}

  if (document.fills && document.fills.length > 0) {
    const fill = document.fills[0] // Take the first fill
    values.type = fill.type

    if (fill.type === 'SOLID' && fill.color) {
      values.color = {
        r: fill.color.r,
        g: fill.color.g,
        b: fill.color.b,
        a: fill.opacity || 1
      }
      values.hex = rgbToHex(fill.color)
      values.css = `rgba(${Math.round(fill.color.r * 255)}, ${Math.round(
        fill.color.g * 255
      )}, ${Math.round(fill.color.b * 255)}, ${fill.opacity || 1})`
    } else if (fill.type === 'GRADIENT') {
      values.gradient = fill.gradientStops
    }
  }

  return values
}

function parseTextStyle(document) {
  const values = {}

  if (document.style) {
    const style = document.style
    values.fontFamily = style.fontFamily
    values.fontWeight = style.fontWeight
    values.fontSize = style.fontSize
    values.lineHeight = style.lineHeightPx
    values.letterSpacing = style.letterSpacing
    values.textCase = style.textCase
    values.textDecoration = style.textDecoration
  }

  return values
}

function parseEffectStyle(document) {
  const values = {}

  if (document.effects && document.effects.length > 0) {
    values.effects = document.effects.map((effect) => ({
      type: effect.type,
      color: effect.color,
      offset: effect.offset,
      radius: effect.radius,
      spread: effect.spread,
      visible: effect.visible
    }))
  }

  return values
}

function parseGridStyle(document) {
  const values = {}

  if (document.layoutGrids && document.layoutGrids.length > 0) {
    values.grids = document.layoutGrids.map((grid) => ({
      pattern: grid.pattern,
      sectionSize: grid.sectionSize,
      visible: grid.visible,
      color: grid.color,
      alignment: grid.alignment,
      gutterSize: grid.gutterSize,
      offset: grid.offset,
      count: grid.count
    }))
  }

  return values
}

// Helper function to extract styles from document structure
function extractStylesFromDocument(document) {
  const styles = {
    colors: new Set(),
    fonts: new Set(),
    effects: new Set()
  }

  // Traverse the document tree to find style information
  function traverseNode(node) {
    if (!node) return

    // Extract fill colors
    if (node.fills && Array.isArray(node.fills)) {
      node.fills.forEach((fill) => {
        if (fill.type === 'SOLID' && fill.color) {
          const color = rgbToHex(fill.color)
          styles.colors.add(color)
        }
      })
    }

    // Extract stroke colors
    if (node.strokes && Array.isArray(node.strokes)) {
      node.strokes.forEach((stroke) => {
        if (stroke.type === 'SOLID' && stroke.color) {
          const color = rgbToHex(stroke.color)
          styles.colors.add(color)
        }
      })
    }

    // Extract text styles
    if (node.style && node.style.fontFamily) {
      styles.fonts.add(
        `${node.style.fontFamily} ${node.style.fontWeight || 'Regular'}`
      )
    }

    // Extract effects
    if (node.effects && Array.isArray(node.effects)) {
      node.effects.forEach((effect) => {
        styles.effects.add(effect.type)
      })
    }

    // Recursively traverse children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child) => traverseNode(child))
    }
  }

  traverseNode(document)

  return {
    colors: Array.from(styles.colors),
    fonts: Array.from(styles.fonts),
    effects: Array.from(styles.effects)
  }
}

// Helper function to convert RGB to hex
function rgbToHex(rgb) {
  const r = Math.round(rgb.r * 255)
  const g = Math.round(rgb.g * 255)
  const b = Math.round(rgb.b * 255)
  return `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Function to get detailed style information
export async function getStyleDetails(fileKey, styleId) {
  if (!validateFileKey(fileKey)) {
    throw new Error('Invalid file key format')
  }

  const data = await fetchFromFigma(`/files/${fileKey}/styles/${styleId}`)

  return data
}

// Function to export styles to various formats
export function exportStylesToCSS(styles) {
  let css = '/* Figma Styles Export */\n\n'

  // Export color styles
  if (styles.styles.fill.length > 0) {
    css += ':root {\n'
    styles.styles.fill.forEach((style) => {
      const varName = style.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

      if (style.values && style.values.hex) {
        css += `  --${varName}: ${style.values.hex}; /* ${style.name} - ${
          style.description || 'No description'
        } */\n`
      } else {
        css += `  --${varName}: /* ${style.name} - ${
          style.description || 'No description'
        } - Value not available */;\n`
      }
    })
    css += '}\n\n'
  }

  // Export text styles
  if (styles.styles.text.length > 0) {
    styles.styles.text.forEach((style) => {
      const className = style.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      css += `.${className} {\n`
      css += `  /* ${style.name} - ${
        style.description || 'No description'
      } */\n`

      if (style.values) {
        if (style.values.fontFamily) {
          css += `  font-family: "${style.values.fontFamily}";\n`
        }
        if (style.values.fontSize) {
          css += `  font-size: ${style.values.fontSize}px;\n`
        }
        if (style.values.fontWeight) {
          css += `  font-weight: ${style.values.fontWeight};\n`
        }
        if (style.values.lineHeight) {
          css += `  line-height: ${style.values.lineHeight}px;\n`
        }
        if (style.values.letterSpacing) {
          css += `  letter-spacing: ${style.values.letterSpacing}px;\n`
        }
      }

      css += '}\n\n'
    })
  }

  return css
}

export function exportStylesToJSON(styles) {
  return JSON.stringify(styles, null, 2)
}

export function exportStylesToTokens(styles) {
  const tokens = {
    colors: {},
    typography: {},
    effects: {}
  }

  // Convert fill styles to color tokens
  styles.styles.fill.forEach((style) => {
    const tokenName = style.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    tokens.colors[tokenName] = {
      value:
        style.values?.hex ||
        style.values?.css ||
        '/* Color value not available */',
      type: 'color',
      description: style.description || ''
    }
  })

  // Convert text styles to typography tokens
  styles.styles.text.forEach((style) => {
    const tokenName = style.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    tokens.typography[tokenName] = {
      value: {
        fontFamily:
          style.values?.fontFamily || '/* Font family not available */',
        fontSize: style.values?.fontSize
          ? `${style.values.fontSize}px`
          : '/* Font size not available */',
        fontWeight:
          style.values?.fontWeight || '/* Font weight not available */',
        lineHeight: style.values?.lineHeight
          ? `${style.values.lineHeight}px`
          : '/* Line height not available */'
      },
      type: 'typography',
      description: style.description || ''
    }
  })

  // Convert effect styles to effect tokens
  styles.styles.effect.forEach((style) => {
    const tokenName = style.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    tokens.effects[tokenName] = {
      value: style.values?.effects || '/* Effect values not available */',
      type: 'effect',
      description: style.description || ''
    }
  })

  return tokens
}
