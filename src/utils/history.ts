export interface HistoryItem {
  id: string
  prompt: string
  output: string
  mode: string
  temperature: number
  maxTokens: number
  createdAt: number
}

const STORAGE_KEY = 'writing_assistant_history'

export function getHistory(): HistoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveToHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): void {
  const history = getHistory()
  const newItem: HistoryItem = {
    ...item,
    id: Date.now().toString(),
    createdAt: Date.now(),
  }
  history.unshift(newItem)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)))
}

export function deleteFromHistory(id: string): void {
  const history = getHistory()
  const filtered = history.filter((item) => item.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp

  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} 分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} 小时前`
  } else if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } else {
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
}
