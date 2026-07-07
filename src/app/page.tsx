"use client";

import { useState } from "react";
import InputForm, { type InsuranceInput } from "@/components/InputForm";
import AnnualRateResult from "@/components/AnnualRateResult";
import FxRiskAnalysis from "@/components/FxRiskAnalysis";
import ComparisonChart from "@/components/ComparisonChart";
import CostBreakdown from "@/components/CostBreakdown";

type Tab = "rate" | "fx" | "compare" | "cost";

export default function Home() {
  const [input, setInput] = useState<InsuranceInput | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("rate");

  const tabs: { key: Tab; label: string }[] = [
    { key: "rate", label: "年率換算" },
    { key: "fx", label: "為替リスク" },
    { key: "compare", label: "他商品比較" },
    { key: "cost", label: "コスト分析" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            保険 vs 投資 比較検証ツール
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ドル建て保険を投資商品として客観的に評価する
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* 入力フォーム */}
        <InputForm onSubmit={setInput} />

        {/* 分析結果 */}
        {input && (
          <>
            {/* タブナビゲーション */}
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* タブコンテンツ */}
            {activeTab === "rate" && <AnnualRateResult input={input} />}
            {activeTab === "fx" && <FxRiskAnalysis input={input} />}
            {activeTab === "compare" && <ComparisonChart input={input} />}
            {activeTab === "cost" && <CostBreakdown input={input} />}
          </>
        )}

        {/* 未入力時の説明 */}
        {!input && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="text-4xl mb-4">&#x1F4CA;</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              保険商品の条件を入力してください
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              ドル建て保険で「10年後に118%」と言われた場合、
              実際の年利はいくらなのか？為替リスクを考慮するとどうなるのか？
              他の投資商品と比べてどうなのか？を検証します。
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="font-medium text-blue-800">年率換算</div>
                <div className="text-blue-600 text-xs mt-1">
                  返戻率を複利年率に変換
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="font-medium text-purple-800">為替リスク</div>
                <div className="text-purple-600 text-xs mt-1">
                  過去データで変動を分析
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="font-medium text-green-800">他商品比較</div>
                <div className="text-green-600 text-xs mt-1">
                  NISA・国債等と比較
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="font-medium text-amber-800">コスト分析</div>
                <div className="text-amber-600 text-xs mt-1">
                  隠れたコストを可視化
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
          <p>
            本ツールは投資判断のための参考情報を提供するものであり、
            特定の金融商品の推奨・勧誘を目的としたものではありません。
          </p>
          <p className="mt-1">
            為替データ: Frankfurter API (ECB) | 計算結果は概算値です
          </p>
        </div>
      </footer>
    </div>
  );
}
