// 為替データ取得ユーティリティ（Frankfurter API）

export interface FxRate {
  date: string;
  rate: number;
}

const CACHE_KEY = "fx_usdjpy_cache";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24時間

interface CacheData {
  timestamp: number;
  rates: FxRate[];
}

function getCache(): CacheData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CacheData = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_EXPIRY) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(rates: FxRate[]) {
  if (typeof window === "undefined") return;
  const data: CacheData = { timestamp: Date.now(), rates };
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

/** Frankfurter APIからUSD/JPYの日次レートを取得 */
export async function fetchUsdJpyRates(
  startDate = "1999-01-04",
  endDate?: string
): Promise<FxRate[]> {
  const cached = getCache();
  if (cached) return cached.rates;

  const end = endDate || new Date().toISOString().split("T")[0];

  // Frankfurter APIは1回で全期間取得可能
  const url = `https://api.frankfurter.app/${startDate}..${end}?from=USD&to=JPY`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch FX data: ${res.status}`);

  const data = await res.json();
  const rates: FxRate[] = Object.entries(data.rates).map(
    ([date, rateObj]) => ({
      date,
      rate: (rateObj as Record<string, number>).JPY,
    })
  );

  rates.sort((a, b) => a.date.localeCompare(b.date));
  setCache(rates);
  return rates;
}

/** N年間保有した場合の為替変動率分布を計算 */
export function fxChangeDistribution(
  rates: FxRate[],
  holdingYears: number
): { entryDate: string; exitDate: string; entryRate: number; exitRate: number; changeRatio: number }[] {
  const results: { entryDate: string; exitDate: string; entryRate: number; exitRate: number; changeRatio: number }[] = [];
  const rateMap = new Map(rates.map((r) => [r.date, r.rate]));
  const dateList = rates.map((r) => r.date);

  for (const entry of dateList) {
    const entryDate = new Date(entry);
    const exitTarget = new Date(entryDate);
    exitTarget.setFullYear(exitTarget.getFullYear() + holdingYears);
    const exitStr = exitTarget.toISOString().split("T")[0];

    // 出口日付に最も近いレートを探す（±5営業日）
    let exitRate: number | undefined;
    let exitDate = exitStr;
    for (let d = 0; d <= 5; d++) {
      const tryDate = new Date(exitTarget);
      tryDate.setDate(tryDate.getDate() + d);
      const key = tryDate.toISOString().split("T")[0];
      if (rateMap.has(key)) {
        exitRate = rateMap.get(key)!;
        exitDate = key;
        break;
      }
      if (d > 0) {
        const tryDate2 = new Date(exitTarget);
        tryDate2.setDate(tryDate2.getDate() - d);
        const key2 = tryDate2.toISOString().split("T")[0];
        if (rateMap.has(key2)) {
          exitRate = rateMap.get(key2)!;
          exitDate = key2;
          break;
        }
      }
    }

    if (exitRate === undefined) continue;

    const entryRate = rateMap.get(entry)!;
    results.push({
      entryDate: entry,
      exitDate,
      entryRate,
      exitRate,
      changeRatio: exitRate / entryRate,
    });
  }

  return results;
}

/**
 * 日次レートから年率換算ボラティリティ（標準偏差）を算出。
 * 対数収益率の標準偏差に√252（年間営業日数の目安）を掛ける金融の標準的手法。
 */
export function annualizedVolatility(rates: FxRate[]): number | null {
  if (rates.length < 3) return null;
  const logReturns: number[] = [];
  for (let i = 1; i < rates.length; i++) {
    const prev = rates[i - 1].rate;
    const cur = rates[i].rate;
    if (prev > 0 && cur > 0) logReturns.push(Math.log(cur / prev));
  }
  const n = logReturns.length;
  if (n < 2) return null;
  const mean = logReturns.reduce((s, r) => s + r, 0) / n;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

/**
 * 過去の変動分布のうち、円建てで元本割れとなった割合。
 * 円建て返戻率 = 為替変動率 × ドル建て返戻率 なので、
 * 為替変動率が損益分岐変動率(= 1 / ドル建て返戻率)を下回ると元本割れ。
 */
export function lossProbability(
  distribution: { changeRatio: number }[],
  breakEvenChangeRatio: number
): number {
  if (distribution.length === 0) return 0;
  const losses = distribution.filter(
    (d) => d.changeRatio < breakEvenChangeRatio
  ).length;
  return losses / distribution.length;
}

/** 分布から統計値を算出 */
export function fxStats(distribution: { changeRatio: number }[]) {
  if (distribution.length === 0) return null;
  const ratios = distribution.map((d) => d.changeRatio).sort((a, b) => a - b);
  const n = ratios.length;
  const mean = ratios.reduce((s, r) => s + r, 0) / n;
  const variance = ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const min = ratios[0];
  const max = ratios[n - 1];
  const median = n % 2 === 0 ? (ratios[n / 2 - 1] + ratios[n / 2]) / 2 : ratios[Math.floor(n / 2)];
  const p5 = ratios[Math.floor(n * 0.05)];
  const p25 = ratios[Math.floor(n * 0.25)];
  const p75 = ratios[Math.floor(n * 0.75)];
  const p95 = ratios[Math.floor(n * 0.95)];

  return { mean, std, min, max, median, p5, p25, p75, p95, count: n };
}
