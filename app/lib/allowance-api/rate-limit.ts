export function createRateLimiter(max: number, windowMs: number): (nowMs: number) => boolean {
  const hits: number[] = []
  return (nowMs: number) => {
    const cutoff = nowMs - windowMs
    while (hits.length > 0 && hits[0] <= cutoff) hits.shift()
    if (hits.length >= max) return false
    hits.push(nowMs)
    return true
  }
}
