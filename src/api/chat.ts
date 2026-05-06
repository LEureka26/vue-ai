export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

const DEFAULT_MODEL = 'glm-4'
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

export async function streamChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
  onToken: (token: string) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const { model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 2048 } = options

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === '[DONE]') continue

        try {
          if (trimmed.startsWith('data: ')) {
            const data = JSON.parse(trimmed.slice(6))
            const content = data.choices?.[0]?.delta?.content
            if (content) {
              onToken(content)
            }
          }
        } catch {
          // Ignore parsing errors for incomplete JSON
        }
      }
    }
  } catch (error) {
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    } else {
      throw error
    }
  }
}

export function getApiKey(): string | null {
  return localStorage.getItem('zhipu_api_key')
}

export function saveApiKey(apiKey: string): void {
  localStorage.setItem('zhipu_api_key', apiKey)
}
