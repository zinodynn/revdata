export function normalizeJsonKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map((v) => normalizeJsonKeys(v))
  if (typeof obj === 'object') {
    const out: any = {}
    for (const k of Object.keys(obj)) {
      let nk = k
      if (typeof nk === 'string' && nk.charCodeAt(0) === 0xfeff) {
        nk = nk.replace(/^\ufeff+/, '')
      }
      out[nk] = normalizeJsonKeys(obj[k])
    }
    return out
  }
  if (typeof obj === 'string') {
    return obj.replace(/\ufeff/g, '')
  }
  return obj
}
