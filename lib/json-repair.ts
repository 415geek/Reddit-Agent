/**
 * 修补模型输出的 JSON。
 *
 * 只针对一个具体病症:字符串值里出现了没转义的半角双引号。
 * 中文选题里"美国的"9.99定价"为什么100年不过时?"这种标题很常见,
 * 模型把它原样塞进 JSON 字符串就断在那个引号上——实测重试两次都一样,
 * 因为源文本里的引号一直在。
 *
 * 做法是自己扫一遍:遇到字符串里的引号,往后看它像不像真正的结束引号
 * (后面是不是 , } ] : 或到头了)。不像就当成内容,补上转义。
 * 修不了就返回 null,交给上层重试。
 */
export function repairJson(text: string): string | null {
  const start = text.search(/[[{]/)
  if (start < 0) return null
  const src = text.slice(start)

  let out = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]

    if (!inString) {
      out += ch
      if (ch === '"') inString = true
      continue
    }

    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch !== '"') {
      // 字符串里的裸换行也是非法的,一并转义掉
      if (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else out += ch
      continue
    }

    // 碰到引号:后面第一个非空白字符决定它是结束引号还是内容
    let j = i + 1
    while (j < src.length && /\s/.test(src[j])) j++
    const next = src[j]
    if (next === undefined || next === ',' || next === '}' || next === ']' || next === ':') {
      out += '"'
      inString = false
    } else {
      out += '\\"'
    }
  }

  try {
    JSON.parse(out)
    return out
  } catch {
    return null
  }
}

/** 依次尝试:直接解析 → 修补后解析。都不行返回 null */
export function parseLoose<T>(text: string): { value: T } | { error: string } {
  try {
    return { value: JSON.parse(text) as T }
  } catch (e) {
    const repaired = repairJson(text)
    if (repaired) {
      try {
        return { value: JSON.parse(repaired) as T }
      } catch {
        /* 落到下面报错 */
      }
    }
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
