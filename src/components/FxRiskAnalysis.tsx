"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchUsdJpyRates, fxChangeDistribution, fxStats } from "@/lib/fx";
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

export default function FxRiskAnalysis({ input }: { input: InsuranceInput }) {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarioRate, setScenarioRate] = useState(input.entryFxRate);

  const totalYears = input.paymentYears + input.deferralYears;
  const ratio = input.returnRatio / 100;
  const beRate = breakEvenRate(input.entryFxRate, ratio);

  const loadRates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchUsdJpyRates();
      setRates(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "為替データの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  // 為替推移（年次でサンプリング）
  const yearlyRates = rates.filter((_, i) => i % 60 === 0); // 約3ヶ月おき

  // N年保有の為替変動分布
  const distribution = rates.length > 0 ? fxChangeDistribution(rates, totalYears) : [];
  const stats = fxStats(distribution);

  // ヒストグラムデータ作成
  const histogramData = (() => {
    if (distribution.length === 0) return [];
    const bins: { range: string; count: number; midRatio: number }[] = [];
    const min = Math.floor((stats!.min - 0.01) * 20) / 20;
    const max = Math.ceil((stats!.max + 0.01) * 20) / 20;
    const step = 0.05;
    for (let b = min; b < max; b += step) {
      const lo = b;
      const hi = b + step;
      const count = distribution.filter(
        (d) => d.changeRatio >= lo && d.changeRatio < hi
      ).length;
      bins.push({
        range: `${(lo * 100).toFixed(0)}%-${(hi * 100).toFixed(0)}%`,
        count,
        midRatio: (lo + hi) / 2,
      });
    }
    return bins;
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
    const sim = simulateWithFx(ratio, input.entryFxRate, s.rate, input.totalPremium);
    return {
      ...s,
      ...sim,
      rate: Math.round(s.rate * 10) / 10,
    };
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
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          為替リスク分析
        </h2>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-500">為替データを取得中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          為替リスク分析
        </h2>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
      <h2 className="text-lg font-bold text-gray-900">為替リスク分析</h2>

      {/* 損益分岐レート */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-xs text-red-600 font-medium">損益分岐レート</div>
          <div className="text-2xl font-bold text-red-800 mt-1">
            ¥{beRate.toFixed(1)}
          </div>
          <div className="text-xs text-red-500 mt-1">
            これ以上円高で元本割れ
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-600 font-medium">加入時レート</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">
            ¥{input.entryFxRate.toFixed(1)}
          </div>
        </div>
        {stats && (
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-xs text-purple-600 font-medium">
              {totalYears}年間の為替変動幅
            </div>
            <div className="text-lg font-bold text-purple-800 mt-1">
              {(stats.min * 100).toFixed(0)}% ~ {(stats.max * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-purple-500 mt-1">
              中央値: {(stats.median * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* USD/JPY推移 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          USD/JPY 為替レート推移
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearlyRates}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(0, 4)}
                interval={Math.floor(yearlyRates.length / 8)}
              />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
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
      </div>

      {/* 為替変動分布ヒストグラム */}
      {histogramData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            {totalYears}年間保有時の為替変動率分布（過去データ）
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} interval={1} />
                <YAxis />
                <Tooltip />
                <ReferenceLine x={`95%-100%`} stroke="red" strokeDasharray="3 3" />
                <Bar dataKey="count" name="頻度">
                  {histogramData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.midRatio < 1 ? "#ef4444" : "#3b82f6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {stats && (
            <div className="mt-2 grid grid-cols-5 gap-2 text-center text-xs">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">最悪</div>
                <div className="font-bold">{(stats.min * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">5%ile</div>
                <div className="font-bold">{(stats.p5 * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">中央値</div>
                <div className="font-bold">
                  {(stats.median * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">95%ile</div>
                <div className="font-bold">{(stats.p95 * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">最良</div>
                <div className="font-bold">{(stats.max * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* シナリオ比較テーブル */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          為替シナリオ別の円建てリターン
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-600">シナリオ</th>
                <th className="text-right py-2 px-3 text-gray-600">
                  受取時レート
                </th>
                <th className="text-right py-2 px-3 text-gray-600">
                  円建て受取額
                </th>
                <th className="text-right py-2 px-3 text-gray-600">損益</th>
                <th className="text-right py-2 px-3 text-gray-600">
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
                  <td className="py-2 px-3 font-medium">{s.label}</td>
                  <td className="text-right py-2 px-3">¥{s.rate}</td>
                  <td className="text-right py-2 px-3">
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
                  <td className="text-right py-2 px-3">
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
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          カスタムシナリオ
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">受取時の為替レート:</label>
          <input
            type="number"
            min={50}
            max={300}
            step={0.1}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:ring-2 focus:ring-blue-500"
            value={scenarioRate}
            onChange={(e) => setScenarioRate(Number(e.target.value))}
          />
          <span className="text-sm text-gray-500">円/ドル</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-500">円建て受取額</div>
            <div className="font-bold text-lg">{fmtYen(customSim.yenAmount)}</div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-500">損益</div>
            <div
              className={`font-bold text-lg ${
                customSim.yenReturn >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {customSim.yenReturn >= 0 ? "+" : ""}
              {fmtYen(customSim.yenReturn)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-500">円建て返戻率</div>
            <div className="font-bold text-lg">
              {(customSim.yenReturnRatio * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
