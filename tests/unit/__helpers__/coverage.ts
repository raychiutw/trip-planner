/** 把「米白圖案疊在純色底」的圖還原成 0~1 的覆蓋率（以 R 通道線性反推），用來跨底色比對圖形。 */
export function coverage(rgb: Uint8Array | Buffer, channels: number, bgR: number, creamR = 0xff): Float32Array {
  const out = new Float32Array(rgb.length / channels)
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, (rgb[i * channels] - bgR) / (creamR - bgR)))
  return out
}

/** 平均絕對差與「差距 > 0.5 的像素比例」 */
export function diffStats(a: Float32Array, b: Float32Array) {
  let sum = 0
  let bad = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    sum += d
    if (d > 0.5) bad++
  }
  return { mean: sum / a.length, badRatio: bad / a.length }
}
