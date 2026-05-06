export type WritingMode = '续写' | '改写' | '扩展' | '总结' | '文案'

export const prompts: Record<WritingMode, (input: string) => string> = {
  续写: (input: string) => `请继续写下面的文章，保持风格一致，内容连贯：\n${input}`,

  改写: (input: string) => `请改写下面的内容，使其更加流畅、专业：\n${input}`,

  扩展: (input: string) => `请扩展下面的内容，增加更多细节和例子：\n${input}`,

  总结: (input: string) => `请总结下面的内容，提取核心要点。输出格式：\n1. 核心观点（3-5 条）\n2. 关键数据（如果有）\n3. 结论（一句话）\n\n内容：\n${input}`,

  文案: (input: string) => `请为以下内容写一段吸引人的营销文案：\n${input}`,
}

export function getPrompt(mode: WritingMode, input: string): string {
  return prompts[mode](input)
}
