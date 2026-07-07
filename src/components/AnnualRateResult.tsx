"use client";

import {
  annualRateFromReturnRatio,
  calculateIRR,
  buildMonthlyCashflows,
  buildYearlyCashflows,
  compoundGrowth,
  compoundGrowthWithContributions,
} from "@/lib/calc";
import type { InsuranceInput } from "./InputForm";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function fmt(n: number, digits = 2) {
  return (n * 100).toFixed(digits) + "%";
}
function fmtYen(n: number) {
  return "¥" + Math.round(n).toLocaleString();
}

export default function AnnualRateResult({ input }: { input: InsuranceInput }) {
  const totalYears = input.paymentYears + input.deferralYears;
  const ratio = input.returnRatio / 100;
  const receivedAmount = input.totalPremium * ratio;

  // 年率計算
  let annualRate: number;
  let method: string;

  if (input.paymentType === "lump") {
    annualRate = annualRateFromReturnRatio(ratio, totalYears);
    method = "複利年率（一括払い）";
  } else if (input.paymentType === "yearly") {
    const yearlyPremium = input.totalPremium / input.paymentYears;
    const cfs = buildYearlyCashflows(
      yearlyPremium,
      input.paymentYears,
      totalYears,
      receivedAmount
    );
    annualRate = calculateIRR(cfs, 0.02);
    method = "IRR（年払い）";
  } else {
    const monthlyPremium = input.totalPremium / (input.paymentYears * 12);
    const cfs = buildMonthlyCashflows(
      monthlyPremium,
      input.paymentYears * 12,
      totalYears * 12,
      receivedAmount
    );
    const monthlyRate = calculateIRR(cfs, 0.003);
    annualRate = Math.pow(1 + monthlyRate, 12) - 1;
    method = "IRR（月払い→年率換算）";
  }

  const simpleRate = (ratio - 1) / totalYears;

  // 為替手数料コスト
  const fxCostRate =
    (input.fxSpread * 2) / input.entryFxRate; // 往復
  const surrenderCostRate = input.surrenderCharge / 100;
  const netAnnualRate = annualRate - fxCostRate / totalYears - surrenderCostRate / totalYears;

  // 資産推移データ
  const insuranceGrowth =
    input.paymentType === "lump"
      ? compoundGrowth(input.totalPremium, annualRate, totalYears)
      : compoundGrowthWithContributions(
          input.totalPremium / input.paymentYears,
          annualRate,
          input.paymentYears,
          totalYears
        );

  // 比較: 同じ年率で普通に運用した場合
  const chartData = insuranceGrowth.map((d) => ({
    year: d.year,
    保険: Math.round(d.amount),
  }));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">年率換算結果</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-600 font-medium">複利年率</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">
            {fmt(annualRate)}
          </div>
          <div className="text-xs text-blue-500 mt-1">{method}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-600 font-medium">単利換算</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">
            {fmt(simpleRate)}
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="text-xs text-amber-600 font-medium">
            手数料控除後年率
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-1">
            {fmt(netAnnualRate)}
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-xs text-green-600 font-medium">受取額</div>
          <div className="text-2xl font-bold text-green-800 mt-1">
            {fmtYen(receivedAmount)}
          </div>
        </div>
      </div>

      {/* 注意書き */}
      <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <strong>注意:</strong>{" "}
        保険の「予定利率」は保険料全額ではなく、手数料・死亡保障コストを差し引いた積立部分にのみ適用されます。
        そのため、予定利率がそのまま実質利回りになるわけではありません。
      </div>

      {/* 資産推移グラフ */}
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        資産推移（ドル建て評価額）
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              label={{ value: "年", position: "insideBottomRight", offset: -5 }}
            />
            <YAxis
              tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [fmtYen(Number(value)), ""]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(label: any) => `${label}年目`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="保険"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
