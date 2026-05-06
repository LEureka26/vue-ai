/**
 * 智谱AI API 调用模块
 * 
 * 参考文档：https://docs.bigmodel.cn/cn/api/introduction
 * 
 * 安全注意事项：
 * - API密钥存储在代码中存在安全风险，建议在生产环境中使用环境变量或密钥管理服务
 * - 请勿将包含密钥的代码提交到版本控制系统
 * - 定期轮换API密钥以提高安全性
 * 
 * 使用方式：
 * 1. 在下方的 API_KEY 常量中填入您的智谱AI API密钥
 * 2. 调用 streamChatCompletion 函数时无需传入API密钥参数
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  signal?: AbortSignal
}

// 智谱AI API密钥
// 请在此处填入您从智谱AI开放平台获取的API密钥
// 获取地址：https://open.bigmodel.cn/
const API_KEY = '903c5f6969e5453da02051ebfc5daa02.gdGDVwlxopRJAMv2'

// API端点（根据官方文档）
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

// 默认模型
const DEFAULT_MODEL = 'glm-4-flash'

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 60000

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiCode?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 流式调用智谱AI聊天完成API
 * 
 * @param messages - 聊天消息数组
 * @param options - 可选配置参数（模型、温度、最大token数、超时时间）
 * @param onToken - 接收到token时的回调函数
 * @throws {ApiError} 当API调用失败时抛出
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
  onToken: (token: string) => void
): Promise<string> {
  if (!API_KEY || (API_KEY as string).trim() === '') {
    throw new ApiError('API密钥未配置，请在 chat.ts 文件中设置有效的 API_KEY')
  }

  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 2048,
    timeout = DEFAULT_TIMEOUT,
    signal: externalSignal,
  } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort())
  }

  let fullContent = ''
  let receivedAnyData = false
  let receivedDone = false
  let sseLineCount = 0
  let contentLineCount = 0

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let errorMessage = `API请求失败 (${response.status})`
      let apiCode: string | undefined
      try {
        const errorData = await response.json()
        if (errorData.error) {
          apiCode = errorData.error.code
          errorMessage = errorData.error.message || errorMessage
        }
      } catch {
        // 无法解析错误响应体
      }
      throw new ApiError(errorMessage, response.status, apiCode)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new ApiError('无法获取响应流，请检查网络连接')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      receivedAnyData = true
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        if (trimmed === '[DONE]') {
          receivedDone = true
          continue
        }

        if (trimmed.startsWith('data: ')) {
          sseLineCount++
          try {
            const data = JSON.parse(trimmed.slice(6))

            if (data.error) {
              throw new ApiError(
                data.error.message || 'API返回错误',
                undefined,
                data.error.code
              )
            }

            const delta = data.choices?.[0]?.delta
            if (delta?.content) {
              contentLineCount++
              fullContent += delta.content
              onToken(delta.content)
            }
          } catch (parseError) {
            if (parseError instanceof ApiError) {
              throw parseError
            }
          }
        }
      }
    }

    if (fullContent.trim()) {
      return fullContent
    }

    if (!receivedAnyData) {
      throw new ApiError(
        'API未返回任何数据，可能原因：\n' +
        '1. API密钥格式不正确（当前使用旧版 {id}.{secret} 格式）\n' +
        '2. 请在智谱AI开放平台重新生成API密钥\n' +
        '3. 模型 ' + model + ' 可能不可用，尝试更换模型'
      )
    }

    if (!receivedDone) {
      throw new ApiError('API响应流异常中断，未收到结束标记')
    }

    throw new ApiError(
      'API返回了空内容，可能原因：\n' +
      '1. API密钥格式不兼容当前API版本\n' +
      '2. 当前密钥为旧版格式({id}.{secret})，请前往 open.bigmodel.cn 重新生成\n' +
      '3. 模型 ' + model + ' 暂不可用，可尝试 glm-4-flash'
    )
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`请求超时（${timeout / 1000}秒），请检查网络连接或稍后重试`)
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('网络连接失败，请检查网络设置或API地址是否正确')
    }
    throw new ApiError(error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 获取API密钥（向后兼容）
 * @deprecated 此方法仅用于向后兼容
 */
export function getApiKey(): string | null {
  return (API_KEY as string).trim() === '' ? null : (API_KEY as string)
}

/**
 * 保存API密钥（向后兼容）
 * @deprecated 此方法仅用于向后兼容，API密钥现在是内置的
 */
export function saveApiKey(_apiKey: string): void {
  console.warn('saveApiKey: API密钥现在是内置的，请修改 chat.ts 文件中的 API_KEY 常量')
}
