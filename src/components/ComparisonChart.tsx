"use client";

import { useState } from "react";
import {
  compoundGrowth,
  compoundGrowthWithContributions,
  afterTaxReturnInsurance,
  afterTaxReturnNISA,
  afterTaxReturnNormal,
  annualRateFromReturnRatio,
  calculateIRR,
  buildYearlyCashflows,
  buildMonthlyCashflows,
} from "@/lib/calc";
import type { InsuranceInput } from "./InputForm";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

function fmtYen(n: number) {
  return "¥" + Math.round(n).toLocaleString();
}

interface ComparisonTarget {
  name: string;
  annualRate: number;
  color: string;
  taxType: "nisa" | "normal" | "insurance";
  description: string;
}

const defaultTargets: ComparisonTarget[] = [
  {
    name: "個人向け国債(変動10年)",
    annualRate: 0.005,
    color: "#6b7280",
    taxType: "normal",
    description: "元本保証、変動金利",
  },
  {
    name: "定期預金",
    annualRate: 0.002,
    color: "#9ca3af",
    taxType: "normal",
    description: "元本保証、固定金利",
  },
  {
    name: "米国債(10年)",
    annualRate: 0.04,
    color: "#f59e0b",
    taxType: "normal",
    description: "為替リスクあり",
  },
  {
    name: "S&P500(NISA)",
    annualRate: 0.07,
    color: "#10b981",
    taxType: "nisa",
    description: "過去平均約7%、非課税",
  },
  {
    name: "全世界株式(NISA)",
    annualRate: 0.06,
    color: "#14b8a6",
    taxType: "nisa",
    description: "過去平均約6%、非課税",
  },
];

export default function ComparisonChart({ input }: { input: InsuranceInput }) {
  const [targets, setTargets] = useState(defaultTargets);
  const [customName, setCustomName] = useState("");
  const [customRate, setCustomRate] = useState(5);

  const totalYears = input.paymentYears + input.deferralYears;
  const ratio = input.returnRatio / 100;
  const receivedAmount = input.totalPremium * ratio;

  // 保険の年率
  let insuranceRate: number;
  if (input.paymentType === "lump") {
    insuranceRate = annualRateFromReturnRatio(ratio, totalYears);
  } else if (input.paymentType === "yearly") {
    const cfs = buildYearlyCashflows(
      input.totalPremium / input.paymentYears,
      input.paymentYears,
      totalYears,
      receivedAmount
    );
    insuranceRate = calculateIRR(cfs, 0.02);
  } else {
    const cfs = buildMonthlyCashflows(
      input.totalPremium / (input.paymentYears * 12),
      input.paymentYears * 12,
      totalYears * 12,
      receivedAmount
    );
    insuranceRate = Math.pow(1 + calculateIRR(cfs, 0.003), 12) - 1;
  }

  // 各資産の最終額計算
  const calcFinalAmount = (rate: number, taxType: string) => {
    let raw: number;
    if (input.paymentType === "lump") {
      raw = compoundGrowth(input.totalPremium, rate, totalYears).slice(-1)[0].amount;
    } else {
      raw = compoundGrowthWithContributions(
        input.totalPremium / input.paymentYears,
        rate,
        input.paymentYears,
        totalYears
      ).slice(-1)[0].amount;
    }
    if (taxType === "nisa") return afterTaxReturnNISA(input.totalPremium, raw);
    if (taxType === "insurance") return afterTaxReturnInsurance(input.totalPremium, raw);
    return afterTaxReturnNormal(input.totalPremium, raw);
  };

  // 保険の税引後は、成長曲線の終点ではなく契約上の受取額(receivedAmount)を基準にする。
  // これにより表の「税引前(=receivedAmount)」と基準が一致する。
  const insuranceFinal = afterTaxReturnInsurance(
    input.totalPremium,
    receivedAmount
  );

  const barData = [
    {
      name: "ドル建て保険",
      税引前: Math.round(receivedAmount),
      税引後: Math.round(insuranceFinal),
      color: "#2563eb",
    },
    ...targets.map((t) => ({
      name: t.name,
      税引前: Math.round(
        input.paymentType === "lump"
          ? compoundGrowth(input.totalPremium, t.annualRate, totalYears).slice(-1)[0].amount
          : compoundGrowthWithContributions(
              input.totalPremium / input.paymentYears,
              t.annualRate,
              input.paymentYears,
              totalYears
            ).slice(-1)[0].amount
      ),
      税引後: Math.round(calcFinalAmount(t.annualRate, t.taxType)),
      color: t.color,
    })),
  ];

  // 資産推移の折れ線データ
  const lineData: Record<string, number | string>[] = [];
  for (let y = 0; y <= totalYears; y++) {
    const point: Record<string, number | string> = { year: y };
    if (input.paymentType === "lump") {
      point["ドル建て保険"] = Math.round(
        compoundGrowth(input.totalPremium, insuranceRate, totalYears)[y].amount
      );
      targets.forEach((t) => {
        point[t.name] = Math.round(
          compoundGrowth(input.totalPremium, t.annualRate, totalYears)[y].amount
        );
      });
    } else {
      point["ドル建て保険"] = Math.round(
        compoundGrowthWithContributions(
          input.totalPremium / input.paymentYears,
          insuranceRate,
          input.paymentYears,
          totalYears
        )[y].amount
      );
      targets.forEach((t) => {
        point[t.name] = Math.round(
          compoundGrowthWithContributions(
            input.totalPremium / input.paymentYears,
            t.annualRate,
            input.paymentYears,
            totalYears
          )[y].amount
        );
      });
    }
    lineData.push(point);
  }

  const allColors = ["#2563eb", ...targets.map((t) => t.color)];
  const allNames = ["ドル建て保険", ...targets.map((t) => t.name)];

  const addCustomTarget = () => {
    if (!customName) return;
    setTargets([
      ...targets,
      {
        name: customName,
        annualRate: customRate / 100,
        color: `hsl(${Math.random() * 360}, 60%, 50%)`,
        taxType: "normal",
        description: "カスタム",
      },
    ]);
    setCustomName("");
    setCustomRate(5);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
      <h2 className="text-lg font-bold text-gray-900">他商品との比較</h2>

      {/* 最終額比較棒グラフ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {totalYears}年後の最終資産額（税引後）
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(v: number) =>
                  v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => fmtYen(Number(value))} />
              <Legend />
              <Bar dataKey="税引後" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar
                dataKey="税引前"
                fill="#93c5fd"
                radius={[0, 4, 4, 0]}
                opacity={0.5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 資産推移折れ線グラフ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          資産推移の比較
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="year"
                label={{
                  value: "年",
                  position: "insideBottomRight",
                  offset: -5,
                }}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`}
              />
              <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [fmtYen(Number(value)), ""]} />
              <Legend />
              {allNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={allColors[i]}
                  strokeWidth={name === "ドル建て保険" ? 3 : 1.5}
                  dot={false}
                  strokeDasharray={
                    name === "ドル建て保険" ? undefined : "5 5"
                  }
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 比較テーブル */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">詳細比較</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-3">商品</th>
                <th className="text-right py-2 px-3">年利</th>
                <th className="text-right py-2 px-3">税引前</th>
                <th className="text-right py-2 px-3">税引後</th>
                <th className="text-right py-2 px-3">利益</th>
                <th className="text-left py-2 px-3">備考</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 bg-blue-50">
                <td className="py-2 px-3 font-medium">ドル建て保険</td>
                <td className="text-right py-2 px-3">
                  {(insuranceRate * 100).toFixed(2)}%
                </td>
                <td className="text-right py-2 px-3">
                  {fmtYen(receivedAmount)}
                </td>
                <td className="text-right py-2 px-3">
                  {fmtYen(insuranceFinal)}
                </td>
                <td className="text-right py-2 px-3 text-green-600">
                  +{fmtYen(insuranceFinal - input.totalPremium)}
                </td>
                <td className="py-2 px-3 text-gray-500">
                  為替リスクあり、一時所得控除
                </td>
              </tr>
              {targets.map((t) => {
                const finalAfterTax = calcFinalAmount(t.annualRate, t.taxType);
                const raw =
                  input.paymentType === "lump"
                    ? compoundGrowth(input.totalPremium, t.annualRate, totalYears).slice(-1)[0].amount
                    : compoundGrowthWithContributions(
                        input.totalPremium / input.paymentYears,
                        t.annualRate,
                        input.paymentYears,
                        totalYears
                      ).slice(-1)[0].amount;
                return (
                  <tr key={t.name} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium">{t.name}</td>
                    <td className="text-right py-2 px-3">
                      {(t.annualRate * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-2 px-3">{fmtYen(raw)}</td>
                    <td className="text-right py-2 px-3">
                      {fmtYen(finalAfterTax)}
                    </td>
                    <td
                      className={`text-right py-2 px-3 ${
                        finalAfterTax - input.totalPremium >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {finalAfterTax - input.totalPremium >= 0 ? "+" : ""}
                      {fmtYen(finalAfterTax - input.totalPremium)}
                    </td>
                    <td className="py-2 px-3 text-gray-500">{t.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* カスタム比較対象追加 */}
      <div className="p-4 bg-gray-50 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          比較対象を追加
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="商品名"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:ring-2 focus:ring-blue-500"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={30}
              step={0.1}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-20 focus:ring-2 focus:ring-blue-500"
              value={customRate}
              onChange={(e) => setCustomRate(Number(e.target.value))}
            />
            <span className="text-sm text-gray-500">%/年</span>
          </div>
          <button
            onClick={addCustomTarget}
            className="bg-gray-800 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
