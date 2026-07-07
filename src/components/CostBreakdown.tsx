"use client";

import type { InsuranceInput } from "./InputForm";
import {
  annualRateFromReturnRatio,
  calculateIRR,
  buildYearlyCashflows,
  buildMonthlyCashflows,
} from "@/lib/calc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function fmtYen(n: number) {
  return "¥" + Math.round(n).toLocaleString();
}

export default function CostBreakdown({ input }: { input: InsuranceInput }) {
  const totalYears = input.paymentYears + input.deferralYears;
  const ratio = input.returnRatio / 100;
  const receivedAmount = input.totalPremium * ratio;

  // 年率
  let annualRate: number;
  if (input.paymentType === "lump") {
    annualRate = annualRateFromReturnRatio(ratio, totalYears);
  } else if (input.paymentType === "yearly") {
    const cfs = buildYearlyCashflows(
      input.totalPremium / input.paymentYears,
      input.paymentYears,
      totalYears,
      receivedAmount
    );
    annualRate = calculateIRR(cfs, 0.02);
  } else {
    const cfs = buildMonthlyCashflows(
      input.totalPremium / (input.paymentYears * 12),
      input.paymentYears * 12,
      totalYears * 12,
      receivedAmount
    );
    annualRate = Math.pow(1 + calculateIRR(cfs, 0.003), 12) - 1;
  }

  // コスト計算
  const dollarAmount = input.totalPremium / input.entryFxRate;
  const fxCostEntry = dollarAmount * input.fxSpread; // 円換算の為替手数料（購入時）
  const fxCostExit = dollarAmount * ratio * input.fxSpread; // 受取時
  const totalFxCost = fxCostEntry + fxCostExit;
  const surrenderCost = receivedAmount * (input.surrenderCharge / 100);

  // 予定利率が例えば3%だった場合の本来の受取額と実際の差
  const assumedPredRate = 0.03; // 米ドル建て予定利率の目安
  const idealReturn = input.totalPremium * Math.pow(1 + assumedPredRate, totalYears);
  const hiddenCost = idealReturn - receivedAmount;

  // 実質利回り
  const netReceived = receivedAmount - totalFxCost - surrenderCost;
  const netReturnRatio = netReceived / input.totalPremium;
  const netAnnualRate = Math.pow(netReturnRatio, 1 / totalYears) - 1;

  // コスト内訳のグラフデータ
  const costData = [
    {
      name: "為替手数料(往復)",
      金額: Math.round(totalFxCost),
      年率換算: ((totalFxCost / input.totalPremium / totalYears) * 100).toFixed(3),
    },
    {
      name: "解約控除",
      金額: Math.round(surrenderCost),
      年率換算: ((surrenderCost / input.totalPremium / totalYears) * 100).toFixed(3),
    },
    {
      name: "保険関係費用(推定)",
      金額: Math.round(hiddenCost > 0 ? hiddenCost : 0),
      年率換算: (
        ((hiddenCost > 0 ? hiddenCost : 0) / input.totalPremium / totalYears) *
        100
      ).toFixed(3),
    },
  ];

  const totalCost = totalFxCost + surrenderCost + (hiddenCost > 0 ? hiddenCost : 0);

  // 何年で元本回収できるか
  const yearsToBreakeven = (() => {
    if (annualRate <= 0) return null;
    // 一括の場合
    if (input.paymentType === "lump") {
      const costPerYear = totalFxCost / totalYears;
      for (let y = 1; y <= 50; y++) {
        const val = input.totalPremium * Math.pow(1 + annualRate, y) - costPerYear * y;
        if (val >= input.totalPremium) return y;
      }
    }
    return totalYears; // 満期まで
  })();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
      <h2 className="text-lg font-bold text-gray-900">コスト構造の見える化</h2>

      {/* サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-600 font-medium">見かけの年率</div>
          <div className="text-xl font-bold text-blue-800 mt-1">
            {(annualRate * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="text-xs text-amber-600 font-medium">実質年率</div>
          <div className="text-xl font-bold text-amber-800 mt-1">
            {(netAnnualRate * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-xs text-red-600 font-medium">総コスト</div>
          <div className="text-xl font-bold text-red-800 mt-1">
            {fmtYen(totalCost)}
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-xs text-green-600 font-medium">
            実質受取額
          </div>
          <div className="text-xl font-bold text-green-800 mt-1">
            {fmtYen(netReceived)}
          </div>
        </div>
      </div>

      {/* コスト内訳グラフ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          コスト内訳
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => fmtYen(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 12 }}
              />
              <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => fmtYen(Number(value))} />
              <Legend />
              <Bar dataKey="金額" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 詳細テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-3">コスト項目</th>
              <th className="text-right py-2 px-3">金額</th>
              <th className="text-right py-2 px-3">年率換算</th>
              <th className="text-left py-2 px-3">説明</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-3">為替手数料（購入時）</td>
              <td className="text-right py-2 px-3">{fmtYen(fxCostEntry)}</td>
              <td className="text-right py-2 px-3">
                {((fxCostEntry / input.totalPremium / totalYears) * 100).toFixed(3)}%
              </td>
              <td className="py-2 px-3 text-gray-500">
                片道{input.fxSpread}円 x {dollarAmount.toFixed(0)}ドル
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-3">為替手数料（受取時）</td>
              <td className="text-right py-2 px-3">{fmtYen(fxCostExit)}</td>
              <td className="text-right py-2 px-3">
                {((fxCostExit / input.totalPremium / totalYears) * 100).toFixed(3)}%
              </td>
              <td className="py-2 px-3 text-gray-500">
                片道{input.fxSpread}円 x {(dollarAmount * ratio).toFixed(0)}ドル
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-3">解約控除</td>
              <td className="text-right py-2 px-3">{fmtYen(surrenderCost)}</td>
              <td className="text-right py-2 px-3">
                {((surrenderCost / input.totalPremium / totalYears) * 100).toFixed(3)}%
              </td>
              <td className="py-2 px-3 text-gray-500">
                受取額の{input.surrenderCharge}%
              </td>
            </tr>
            {hiddenCost > 0 && (
              <tr className="border-b border-gray-100 bg-yellow-50">
                <td className="py-2 px-3">保険関係費用（推定）</td>
                <td className="text-right py-2 px-3">
                  {fmtYen(hiddenCost)}
                </td>
                <td className="text-right py-2 px-3">
                  {((hiddenCost / input.totalPremium / totalYears) * 100).toFixed(3)}%
                </td>
                <td className="py-2 px-3 text-gray-500">
                  予定利率{(assumedPredRate * 100).toFixed(1)}%で全額運用した場合との差
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-gray-300 font-bold">
              <td className="py-2 px-3">合計</td>
              <td className="text-right py-2 px-3 text-red-600">
                {fmtYen(totalCost)}
              </td>
              <td className="text-right py-2 px-3 text-red-600">
                {((totalCost / input.totalPremium / totalYears) * 100).toFixed(3)}%
              </td>
              <td className="py-2 px-3 text-gray-500">
                {yearsToBreakeven
                  ? `元本回収まで約${yearsToBreakeven}年`
                  : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <strong>保険関係費用について:</strong>{" "}
        保険料から死亡保障のための保険関係費用が差し引かれた後の金額が積立運用されます。
        この費用は商品によって異なり、一般に開示されていないため、予定利率3%を仮定した推定値です。
      </div>
    </div>
  );
}
