import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { getPrompt } from './promptTemplates'
import { streamChatCompletion } from './api/chat'
import type { WritingMode } from './promptTemplates'
import { getHistory, saveToHistory, deleteFromHistory, formatTime, type HistoryItem } from './utils/history'

const MODES: WritingMode[] = ['续写', '改写', '扩展', '总结', '文案']
const MODE_LABELS: Record<WritingMode, string> = {
  续写: '文章续写',
  改写: '内容改写',
  扩展: '内容扩展',
  总结: '内容总结',
  文案: '文案生成',
}

const TEMPERATURE_OPTIONS = [
  { value: 0.3, label: '保守 (0.3)' },
  { value: 0.5, label: '平衡偏保守 (0.5)' },
  { value: 0.7, label: '平衡 (0.7)' },
  { value: 0.85, label: '创意 (0.85)' },
  { value: 1.0, label: '很有创意 (1.0)' },
]

interface TokenOption {
  value: number
  label: string
}

const DEFAULT_MAX_TOKENS_OPTIONS: TokenOption[] = [
  { value: 100, label: '简短 (100字)' },
  { value: 500, label: '中等 (500字)' },
  { value: 1000, label: '较长 (1000字)' },
  { value: 1200, label: '详细 (1200字)' },
]

function getMaxTokensOptions(customOptions?: TokenOption[]): TokenOption[] {
  if (customOptions && customOptions.length > 0) {
    return customOptions
  }
  return DEFAULT_MAX_TOKENS_OPTIONS
}

const BASE_WIDTH = 1280
const PC_BREAKPOINT = 1024

function App() {
  const [mode, setMode] = useState<WritingMode>('续写')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(100)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null)
  const [scale, setScale] = useState(1)
  const [isPc, setIsPc] = useState(true)

  const outputRef = useRef('')

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  useEffect(() => {
    const handleResize = () => {
      const vw = window.innerWidth
      const pc = vw >= PC_BREAKPOINT
      setIsPc(pc)
      setScale(pc ? 1 : vw / BASE_WIDTH)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const refreshHistory = () => {
    setHistory(getHistory())
  }

  const handleGenerate = async () => {
    if (!input.trim()) return

    setLoading(true)
    setOutput('')
    setError('')
    setSelectedHistory(null)
    outputRef.current = ''

    const prompt = getPrompt(mode, input)

    try {
      const finalOutput = await streamChatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature, maxTokens },
        (token) => {
          outputRef.current += token
          setOutput(outputRef.current)
        }
      )

      if (finalOutput.trim()) {
        saveToHistory({
          prompt: input.trim(),
          output: finalOutput.trim(),
          mode,
          temperature,
          maxTokens,
        })
        refreshHistory()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      if (outputRef.current.trim()) {
        saveToHistory({
          prompt: input.trim(),
          output: outputRef.current.trim(),
          mode,
          temperature,
          maxTokens,
        })
        refreshHistory()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        width: BASE_WIDTH + 'px',
        margin: isPc ? '0 auto' : '0',
        transform: isPc ? 'none' : `scale(${scale})`,
        transformOrigin: 'top left',
        minHeight: isPc ? '100vh' : `calc(100vh / ${scale})`,
      }}
      className="bg-[#f5f5f5]"
    >
      {/* 顶部标题 */}
      <header className="bg-[#fdfbf8] ">
        {/* 这是一个容器div，使用Tailwind CSS类名：
            - max-w-7xl: 最大宽度为80rem (1280px)
            - mx-auto: 水平居中（左右margin自动）
            - px-6: 水平内边距1.5rem (24px)
            - py-6: 垂直内边距1.5rem (24px)
            - text-center: 文本居中对齐
            作用：限制内容最大宽度并居中，添加内边距，使标题和副标题居中显示 */}
        <div className="max-w-7xl mx-auto px-6 py-6 text-center">
          <h1 className="text-2xl font-bold text-[#d4b038] mb-2">智能写作助手</h1>
          <p className="text-xs text-[#d4b038]">AI Writing Assistant · 让文字更有力量</p>
        </div>
        <div className="h-px bg-[#d4b038] w-[92%] mx-auto" />
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-sm text-red-600 whitespace-pre-line">
            {error}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* 左侧边栏 */}
          <div className="col-span-2">
            {/* 写作模式 */}
            <div className="bg-white rounded border border-[#e8d5b8] p-3 mb-4">
              <h3 className="text-xs font-medium text-[#8b7355] mb-3 px-1">写作模式</h3>
              <div className="space-y-1">
                {MODES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`w-full text-sm text-left px-3 py-2 rounded transition-all ${
                      mode === m
                        ? 'bg-[#d4b038] text-white'
                        : 'text-gray-600 hover:bg-[#faf6f0]'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* 历史记录 */}
            <div className="bg-white rounded border border-[#e8d5b8] p-3">
              <h3 className="text-xs font-medium text-[#8b7355] mb-3 px-1">历史记录</h3>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">暂无历史记录</p>
                ) : (
                  history.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className={`cursor-pointer text-xs px-3 py-2 rounded transition-all ${
                        selectedHistory?.id === item.id
                          ? 'bg-[#faf6f0] border-l-2 border-[#d4b038]'
                          : 'hover:bg-[#faf6f0]'
                      }`}
                      onClick={() => setSelectedHistory(item)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 line-clamp-1">
                          {item.prompt.length > 20 ? item.prompt.slice(0, 20) + '...' : item.prompt}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteFromHistory(item.id)
                            refreshHistory()
                            if (selectedHistory?.id === item.id) {
                              setSelectedHistory(null)
                            }
                          }}
                          className="text-gray-400 hover:text-red-500 ml-2"
                        >
                          ×
                        </button>
                      </div>
                      <span className="text-gray-400 text-xs mt-0.5">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    window.localStorage.removeItem('writing_assistant_history')
                    setHistory([])
                    setSelectedHistory(null)
                  }}
                  className="w-full text-xs text-gray-400 hover:text-red-500 mt-2 py-1"
                >
                  清空记录
                </button>
              )}
            </div>
          </div>

          {/* 右侧主内容 */}
          <div className="col-span-10">
            {/* 参数栏 */}
            <div className="bg-white rounded border border-[#e8d5b8] p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[#8b7355]">创意度</label>
                  <select
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="bg-[#faf6f0] border border-[#d4b038] rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#d4b038]"
                  >
                    {TEMPERATURE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[#8b7355]">输出长度</label>
                  <select
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="bg-[#faf6f0] border border-[#d4b038] rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#d4b038]"
                  >
                    {getMaxTokensOptions().map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={!input.trim() || loading}
                className="px-6 py-2 bg-[#d4b038] text-white text-sm font-medium rounded hover:bg-[#c49564] disabled:bg-[#e8d5b8] disabled:text-gray-400 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    生成中...
                  </>
                ) : (
                  '生成内容'
                )}
              </button>
            </div>

            {/* 输入输出区域 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 输入区域 */}
              <div className="bg-white rounded border border-[#e8d5b8]">
                <div className="px-4 py-2 border-b border-[#d4b038] flex items-center">
                  <div className="h-px flex-1 bg-[#d4b038]" />
                  <span className="px-3 text-xs font-medium text-[#8b7355]">输入</span>
                  <div className="h-px flex-1 bg-[#d4b038]" />
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="在这里输入你想要处理的文本内容..."
                  className="w-full p-4 h-[400px] resize-none focus:outline-none text-sm text-gray-700 placeholder-gray-400 overflow-y-auto"
                />
                <div className="px-4 py-2 border-t border-[#e8d5b8] flex justify-between items-center">
                  <span className="text-xs text-gray-400">{input.length} 字</span>
                  {input.length > 0 && (
                    <button
                      onClick={() => setInput('')}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>

              {/* 输出区域 */}
              <div className="bg-white rounded border border-[#e8d5b8]">
                <div className="px-4 py-2 border-b border-[#d4b038] flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-px w-4 bg-[#d4b038]" />
                    <span className="px-3 text-xs font-medium text-[#8b7355]">输出</span>
                    <div className="h-px flex-1 bg-[#d4b038]" />
                  </div>
                  {selectedHistory && (
                    <button
                      onClick={() => setSelectedHistory(null)}
                      className="text-xs text-[#d4b038] hover:text-[#b89060]"
                    >
                      返回生成
                    </button>
                  )}
                </div>
                <div className="p-4 h-[400px] overflow-y-auto">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#d4b038]">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#d4b038] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#d4b038] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#d4b038] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs mt-2">AI 正在创作中...</span>
                    </div>
                  ) : selectedHistory ? (
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-xl font-bold text-[#d4b038] mt-4 mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-semibold text-[#d4b038] mt-3 mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-semibold text-[#d4b038] mt-2 mb-1">{children}</h3>,
                          p: ({ children }) => <p className="mb-2">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-[#d4b038]">{children}</strong>,
                          em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                          code: ({ children }) => <code className="px-1.5 py-0.5 bg-[#faf6f0] rounded text-xs font-mono">{children}</code>,
                          blockquote: ({ children }) => <blockquote className="border-l-2 border-[#d4b038] pl-3 italic text-gray-600 my-2">{children}</blockquote>,
                        }}
                      >
                        {selectedHistory.output}
                      </ReactMarkdown>
                    </div>
                  ) : output ? (
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-xl font-bold text-[#d4b038] mt-4 mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-semibold text-[#d4b038] mt-3 mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-semibold text-[#d4b038] mt-2 mb-1">{children}</h3>,
                          p: ({ children }) => <p className="mb-2">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-[#d4b038]">{children}</strong>,
                          em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                          code: ({ children }) => <code className="px-1.5 py-0.5 bg-[#faf6f0] rounded text-xs font-mono">{children}</code>,
                          blockquote: ({ children }) => <blockquote className="border-l-2 border-[#d4b038] pl-3 italic text-gray-600 my-2">{children}</blockquote>,
                        }}
                      >
                        {output}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs mt-2">在左侧输入内容并点击生成按钮</span>
                    </div>
                  )}
                </div>
                {(output || selectedHistory) && (
                  <div className="px-4 py-2 border-t border-[#e8d5b8] flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      字数：{(selectedHistory?.output.length || output.length)}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedHistory?.output || output)
                      }}
                      className="text-xs text-[#d4b038] hover:text-[#b89060]"
                    >
                      复制内容
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
