"use client";

import { useState, useEffect } from "react";
import {
  fetchUsdJpyRates,
  fxChangeDistribution,
  fxStats,
  annualizedVolatility,
  lossProbability,
} from "@/lib/fx";
import { breakEvenRate, simulateWithFx } from "@/lib/calc";
import type { InsuranceInput } from "./InputForm";
import type { FxRate } from "@/lib/fx";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

function fmtYen(n: number) {
  return "¥" + Math.round(n).toLocaleString();
}

/** 変動率(1.0基準)を「+X%/-X%」の円安・円高表現に変換 */
function fmtChange(ratio: number) {
  const pct = (ratio - 1) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export default function FxRiskAnalysis({ input }: { input: InsuranceInput }) {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarioRate, setScenarioRate] = useState(input.entryFxRate);

  const totalYears = input.paymentYears + input.deferralYears;
  const ratio = input.returnRatio / 100;
  const beRate = breakEvenRate(input.entryFxRate, ratio);
  // 損益分岐となる為替変動率（加入時比）。これを下回る円高で円建て元本割れ。
  const beChangeRatio = 1 / ratio;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchUsdJpyRates();
        if (active) setRates(data);
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error ? e.message : "為替データの取得に失敗しました"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 為替推移（約3ヶ月おきにサンプリング）
  const yearlyRates = rates.filter((_, i) => i % 60 === 0);

  // N年保有の為替変動分布
  const distribution =
    rates.length > 0 ? fxChangeDistribution(rates, totalYears) : [];
  const stats = fxStats(distribution);
  const annVol = annualizedVolatility(rates);
  const lossProb = lossProbability(distribution, beChangeRatio);

  // ヒストグラムデータ作成
  const step = 0.05;
  const histogramData = (() => {
    if (!stats) return [];
    const bins: {
      range: string;
      count: number;
      midRatio: number;
      isLoss: boolean;
    }[] = [];
    const min = Math.floor((stats.min - 0.01) * 20) / 20;
    const max = Math.ceil((stats.max + 0.01) * 20) / 20;
    for (let b = min; b < max - 1e-9; b += step) {
      const lo = b;
      const hi = b + step;
      const count = distribution.filter(
        (d) => d.changeRatio >= lo && d.changeRatio < hi
      ).length;
      const mid = (lo + hi) / 2;
      bins.push({
        range: `${fmtChange(lo)}`,
        count,
        midRatio: mid,
        isLoss: mid < beChangeRatio,
      });
    }
    return bins;
  })();

  // 損益分岐が入るビンのラベル（ReferenceLine配置用）
  const beBinLabel = (() => {
    const bin = histogramData.find(
      (b) => b.midRatio - step / 2 <= beChangeRatio && beChangeRatio < b.midRatio + step / 2
    );
    return bin?.range;
  })();

  // シナリオシミュレーション
  const scenarios = [
    { label: "円高20%", rate: input.entryFxRate * 0.8 },
    { label: "円高10%", rate: input.entryFxRate * 0.9 },
    { label: "円高5%", rate: input.entryFxRate * 0.95 },
    { label: "変動なし", rate: input.entryFxRate },
    { label: "円安5%", rate: input.entryFxRate * 1.05 },
    { label: "円安10%", rate: input.entryFxRate * 1.1 },
    { label: "円安20%", rate: input.entryFxRate * 1.2 },
  ];

  const scenarioResults = scenarios.map((s) => {
    const sim = simulateWithFx(
      ratio,
      input.entryFxRate,
      s.rate,
      input.totalPremium
    );
    return { ...s, ...sim, rate: Math.round(s.rate * 10) / 10 };
  });

  // ユーザー入力シナリオ
  const customSim = simulateWithFx(
    ratio,
    input.entryFxRate,
    scenarioRate,
    input.totalPremium
  );

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">為替リスク分析</h2>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">為替データを取得中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">為替リスク分析</h2>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      </div>
    );
  }

  const lossLevel =
    lossProb >= 0.3 ? "high" : lossProb >= 0.1 ? "mid" : "low";
  const lossColor =
    lossLevel === "high"
      ? { bg: "bg-red-50", label: "text-red-700", num: "text-red-800", sub: "text-red-600" }
      : lossLevel === "mid"
      ? { bg: "bg-amber-50", label: "text-amber-700", num: "text-amber-800", sub: "text-amber-600" }
      : { bg: "bg-green-50", label: "text-green-700", num: "text-green-800", sub: "text-green-600" };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
      <h2 className="text-lg font-bold text-gray-900">為替リスク分析</h2>

      {/* 為替リスクの解説 */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-gray-800 leading-relaxed">
        <p className="font-semibold text-blue-900 mb-1">為替リスクとは</p>
        <p>
          ドル建て保険は、払い込んだ保険料を<strong>ドルに換えて運用</strong>し、受取時に
          <strong>円へ戻します</strong>。満期のドル建て金額が確定していても、受取時の為替レートが
          加入時より<strong>円高</strong>になると、円での手取りは目減りします。
          このツールでは加入時レート
          <strong>¥{input.entryFxRate.toFixed(1)}</strong>に対し、受取時が
          <strong className="text-red-700">¥{beRate.toFixed(1)}</strong>
          （約{fmtChange(beChangeRatio)}）を下回ると、
          ドル建てで{(ratio * 100).toFixed(0)}%に増えていても円建てでは<strong>元本割れ</strong>します。
        </p>
      </div>

      {/* 主要指標 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-xs text-red-700 font-medium">損益分岐レート</div>
          <div className="text-2xl font-bold text-red-800 mt-1">
            ¥{beRate.toFixed(1)}
          </div>
          <div className="text-xs text-red-600 mt-1">
            これ以上の円高で元本割れ
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-700 font-medium">加入時レート</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">
            ¥{input.entryFxRate.toFixed(1)}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            許容円高幅 {fmtChange(beChangeRatio)}
          </div>
        </div>
        <div className={`${lossColor.bg} rounded-xl p-4 text-center`}>
          <div className={`text-xs ${lossColor.label} font-medium`}>
            円建て元本割れ確率
          </div>
          <div className={`text-2xl font-bold ${lossColor.num} mt-1`}>
            {(lossProb * 100).toFixed(1)}%
          </div>
          <div className={`text-xs ${lossColor.sub} mt-1`}>
            過去{totalYears}年保有の実績
          </div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <div className="text-xs text-purple-700 font-medium">
            年率ボラティリティ
          </div>
          <div className="text-2xl font-bold text-purple-800 mt-1">
            {annVol ? (annVol * 100).toFixed(1) + "%" : "—"}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            USD/JPYの変動の大きさ
          </div>
        </div>
      </div>

      {/* USD/JPY推移 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          USD/JPY 為替レート推移（1999年〜）
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearlyRates} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(0, 4)}
                interval={Math.floor(yearlyRates.length / 8)}
                tick={{ fontSize: 11, fill: "#4b5563" }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#4b5563" }}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`¥${Number(v).toFixed(1)}`, "USD/JPY"]}
              />
              <ReferenceLine
                y={input.entryFxRate}
                stroke="#2563eb"
                strokeDasharray="4 4"
                label={{
                  value: `加入時 ¥${input.entryFxRate.toFixed(0)}`,
                  position: "insideTopLeft",
                  fill: "#2563eb",
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                y={beRate}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{
                  value: `損益分岐 ¥${beRate.toFixed(0)}`,
                  position: "insideBottomLeft",
                  fill: "#dc2626",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#7c3aed"
                strokeWidth={1.5}
                dot={false}
                name="USD/JPY"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          紫線が実際の為替レート。<span className="text-red-600 font-medium">赤の損益分岐線</span>を
          下回っていた期間は、その時点に受け取れば円建てで元本割れになる水準です。
        </p>
      </div>

      {/* 為替変動分布ヒストグラム */}
      {histogramData.length > 0 && stats && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">
            {totalYears}年間保有時の為替変動率の分布（過去実績）
          </h3>
          <p className="text-xs text-gray-600 mb-2">
            過去のあらゆる開始時点から{totalYears}年間保有した場合の、加入時比の為替変動率を集計。
            <span className="text-red-600 font-medium">赤い棒</span>が元本割れ、
            <span className="text-blue-600 font-medium">青い棒</span>が利益となる領域です。
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 10, fill: "#4b5563" }}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 11, fill: "#4b5563" }} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${v}回`, "該当期間数"]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(l: any) => `変動率 ${l}〜`}
                />
                {beBinLabel && (
                  <ReferenceLine
                    x={beBinLabel}
                    stroke="#dc2626"
                    strokeWidth={2}
                    label={{
                      value: "損益分岐",
                      position: "top",
                      fill: "#dc2626",
                      fontSize: 10,
                    }}
                  />
                )}
                <Bar dataKey="count" name="頻度">
                  {histogramData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isLoss ? "#ef4444" : "#3b82f6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* パーセンタイル */}
          <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
            <div className="bg-gray-100 rounded p-2">
              <div className="text-gray-600">最悪</div>
              <div className="font-bold text-gray-900">
                {fmtChange(stats.min)}
              </div>
            </div>
            <div className="bg-gray-100 rounded p-2">
              <div className="text-gray-600">下位5%</div>
              <div className="font-bold text-gray-900">
                {fmtChange(stats.p5)}
              </div>
            </div>
            <div className="bg-gray-100 rounded p-2">
              <div className="text-gray-600">中央値</div>
              <div className="font-bold text-gray-900">
                {fmtChange(stats.median)}
              </div>
            </div>
            <div className="bg-gray-100 rounded p-2">
              <div className="text-gray-600">上位5%</div>
              <div className="font-bold text-gray-900">
                {fmtChange(stats.p95)}
              </div>
            </div>
            <div className="bg-gray-100 rounded p-2">
              <div className="text-gray-600">最良</div>
              <div className="font-bold text-gray-900">
                {fmtChange(stats.max)}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            統計的解釈：{totalYears}年保有時の為替変動は平均
            <strong>{fmtChange(stats.mean)}</strong>、標準偏差
            <strong>{(stats.std * 100).toFixed(1)}pt</strong>。
            <strong>VaR（95%信頼水準）</strong>では、最悪ケースの5%に入ると為替だけで
            <strong className="text-red-700">{fmtChange(stats.p5)}</strong>
            の円高となり、損益分岐（{fmtChange(beChangeRatio)}）を
            {stats.p5 < beChangeRatio ? "下回ります" : "上回ります"}。
          </p>
        </div>
      )}

      {/* シナリオ比較テーブル */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          為替シナリオ別の円建てリターン
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-3 text-gray-700">シナリオ</th>
                <th className="text-right py-2 px-3 text-gray-700">
                  受取時レート
                </th>
                <th className="text-right py-2 px-3 text-gray-700">
                  円建て受取額
                </th>
                <th className="text-right py-2 px-3 text-gray-700">損益</th>
                <th className="text-right py-2 px-3 text-gray-700">
                  円建て返戻率
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarioResults.map((s) => (
                <tr
                  key={s.label}
                  className={`border-b border-gray-100 ${
                    s.yenReturn < 0 ? "bg-red-50" : ""
                  }`}
                >
                  <td className="py-2 px-3 font-medium text-gray-900">
                    {s.label}
                  </td>
                  <td className="text-right py-2 px-3 text-gray-800">
                    ¥{s.rate}
                  </td>
                  <td className="text-right py-2 px-3 text-gray-800">
                    {fmtYen(s.yenAmount)}
                  </td>
                  <td
                    className={`text-right py-2 px-3 font-medium ${
                      s.yenReturn < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {s.yenReturn >= 0 ? "+" : ""}
                    {fmtYen(s.yenReturn)}
                  </td>
                  <td className="text-right py-2 px-3 text-gray-800">
                    {(s.yenReturnRatio * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* カスタムシナリオ */}
      <div className="p-4 bg-gray-50 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          カスタムシナリオ
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700">受取時の為替レート:</label>
          <input
            type="number"
            min={50}
            max={300}
            step={0.1}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 text-gray-900 focus:ring-2 focus:ring-blue-500"
            value={scenarioRate}
            onChange={(e) => setScenarioRate(Number(e.target.value))}
          />
          <span className="text-sm text-gray-600">円/ドル</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-600">円建て受取額</div>
            <div className="font-bold text-lg text-gray-900">
              {fmtYen(customSim.yenAmount)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-600">損益</div>
            <div
              className={`font-bold text-lg ${
                customSim.yenReturn >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {customSim.yenReturn >= 0 ? "+" : ""}
              {fmtYen(customSim.yenReturn)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-600">円建て返戻率</div>
            <div className="font-bold text-lg text-gray-900">
              {(customSim.yenReturnRatio * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* 総括 */}
      {stats && (
        <div className="p-4 bg-gray-900 rounded-xl text-sm text-gray-100 leading-relaxed">
          <p className="font-semibold mb-1 text-white">まとめ</p>
          <p>
            ドル建て{(ratio * 100).toFixed(0)}%という数字は<strong>ドルベース</strong>の話であり、
            円で受け取る実際の成果は為替次第です。過去実績では{totalYears}年保有時に
            <strong className="text-amber-300"> {(lossProb * 100).toFixed(1)}% </strong>
            の確率で円建て元本割れが発生しており、年率ボラティリティ
            {annVol ? ` 約${(annVol * 100).toFixed(0)}%` : ""}
            という変動の大きさは、この商品の実質的なリターン
            （年率換算タブ参照）を容易に打ち消し得る水準です。
            受取時に<strong className="text-red-300">¥{beRate.toFixed(1)}</strong>
            を上回る円安であることが、円建てで利益を得る条件となります。
          </p>
        </div>
      )}
    </div>
  );
}
