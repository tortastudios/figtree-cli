import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  generateCodeFromStyles,
  generateDesignTokens
} from '../src/ai-providers.js'

const styles = {
  styles: { fill: [], text: [], effect: [], grid: [] }
}
const tokens = {
  colors: { primary: { value: '#007aff', type: 'color' } },
  typography: {
    heading: {
      value: { fontFamily: 'Inter', fontSize: '32px', fontWeight: '700' },
      type: 'typography'
    }
  },
  spacing: { small: { value: '8px', type: 'spacing' } },
  effects: { shadow: { value: '0 2px 4px #0003', type: 'effect' } }
}

// Exercise the real SDK adapters with HTTP fixtures, without live keys or billing.
for (const [provider, envKey, model] of [
  ['openai', 'OPENAI_API_KEY', 'gpt-4o'],
  ['anthropic', 'ANTHROPIC_API_KEY', 'claude-sonnet-4-20250514'],
  ['google', 'GOOGLE_API_KEY', 'gemini-2.5-flash'],
  ['deepseek', 'DEEPSEEK_API_KEY', 'deepseek-chat']
]) {
  for (const structured of [false, true]) {
    test(`${provider}: ${structured ? 'structured design tokens' : 'text code'}`, async (t) => {
      const previousKey = process.env[envKey]
      process.env[envKey] = 'fixture-key'
      t.after(() => {
        if (previousKey === undefined) delete process.env[envKey]
        else process.env[envKey] = previousKey
      })
      const text = structured ? JSON.stringify(tokens) : ':root { --primary: #007aff; }'
      const requests = []
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        const body = JSON.parse(options.body)
        requests.push({ url: String(url), body })
        let response
        if (provider === 'anthropic') {
          response = {
            id: 'msg_fixture', type: 'message', role: 'assistant', model,
            content: [{ type: 'text', text }], stop_reason: 'end_turn',
            stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 }
          }
        } else if (provider === 'google') {
          response = {
            candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 }
          }
        } else {
          response = {
            id: 'chatcmpl-fixture', object: 'chat.completion', created: 1, model,
            choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
          }
        }
        return Response.json(response)
      })
      const options = { provider, model }
      const actual = structured
        ? await generateDesignTokens(styles, options)
        : await generateCodeFromStyles(styles, options)
      assert.deepEqual(actual, structured ? tokens : text)
      assert.equal(requests.length, 1)
      if (provider === 'openai' || provider === 'deepseek') {
        assert.match(requests[0].url, /\/chat\/completions$/)
      }
      if (structured && provider === 'openai') {
        const schema = requests[0].body.response_format.json_schema.schema
        assert.equal(schema.properties.colors.additionalProperties.type, 'object')
        assert.equal(schema.properties.spacing.additionalProperties.type, 'object')
      }
    })
  }
}
