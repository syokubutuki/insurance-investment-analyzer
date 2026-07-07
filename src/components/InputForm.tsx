"use client";

import { useState } from "react";

export interface InsuranceInput {
  paymentType: "lump" | "monthly" | "yearly";
  paymentYears: number;
  deferralYears: number;
  returnRatio: number;
  totalPremium: number;
  entryFxRate: number;
  fxSpread: number;
  surrenderCharge: number;
}

const defaults: InsuranceInput = {
  paymentType: "lump",
  paymentYears: 10,
  deferralYears: 0,
  returnRatio: 118,
  totalPremium: 1000000,
  entryFxRate: 150,
  fxSpread: 0.5,
  surrenderCharge: 0,
};

export default function InputForm({
  onSubmit,
}: {
  onSubmit: (input: InsuranceInput) => void;
}) {
  const [form, setForm] = useState<InsuranceInput>(defaults);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof InsuranceInput>(
    key: K,
    value: InsuranceInput[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const totalYears = form.paymentYears + form.deferralYears;

  /** 送信前の検証。空欄(=0)や不正値のまま計算するとInfinity/NaNになるため弾く。 */
  const handleSubmit = () => {
    if (!Number.isFinite(form.paymentYears) || form.paymentYears < 1) {
      return setError("払込期間は1年以上を入力してください。");
    }
    if (!Number.isFinite(form.deferralYears) || form.deferralYears < 0) {
      return setError("据置期間は0年以上を入力してください。");
    }
    if (!Number.isFinite(form.returnRatio) || form.returnRatio <= 0) {
      return setError("返戻率は0より大きい値を入力してください。");
    }
    if (!Number.isFinite(form.totalPremium) || form.totalPremium <= 0) {
      return setError("払込保険料総額は0より大きい値を入力してください。");
    }
    if (!Number.isFinite(form.entryFxRate) || form.entryFxRate <= 0) {
      return setError("加入時為替レートは0より大きい値を入力してください。");
    }
    setError(null);
    onSubmit(form);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        保険商品の条件入力
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 払込方法 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            払込方法
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.paymentType}
            onChange={(e) =>
              update("paymentType", e.target.value as InsuranceInput["paymentType"])
            }
          >
            <option value="lump">一括払い</option>
            <option value="yearly">年払い</option>
            <option value="monthly">月払い</option>
          </select>
        </div>

        {/* 払込期間 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            払込期間（年）
          </label>
          <input
            type="number"
            min={1}
            max={50}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.paymentYears}
            onChange={(e) => update("paymentYears", Number(e.target.value))}
          />
        </div>

        {/* 据置期間 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            据置期間（年）
          </label>
          <input
            type="number"
            min={0}
            max={50}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.deferralYears}
            onChange={(e) => update("deferralYears", Number(e.target.value))}
          />
        </div>

        {/* 返戻率 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            返戻率（%）
          </label>
          <input
            type="number"
            min={50}
            max={500}
            step={0.1}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.returnRatio}
            onChange={(e) => update("returnRatio", Number(e.target.value))}
          />
        </div>

        {/* 払込保険料総額 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            払込保険料総額（円）
          </label>
          <input
            type="number"
            min={10000}
            step={10000}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.totalPremium}
            onChange={(e) => update("totalPremium", Number(e.target.value))}
          />
        </div>

        {/* 加入時為替レート */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            加入時為替レート（円/ドル）
          </label>
          <input
            type="number"
            min={50}
            max={300}
            step={0.1}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.entryFxRate}
            onChange={(e) => update("entryFxRate", Number(e.target.value))}
          />
        </div>

        {/* 為替手数料 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            為替手数料（片道、円）
          </label>
          <input
            type="number"
            min={0}
            max={5}
            step={0.01}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.fxSpread}
            onChange={(e) => update("fxSpread", Number(e.target.value))}
          />
        </div>

        {/* 解約控除率 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            解約控除率（%）
          </label>
          <input
            type="number"
            min={0}
            max={30}
            step={0.1}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={form.surrenderCharge}
            onChange={(e) => update("surrenderCharge", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        運用期間合計: <strong>{totalYears}年</strong>（払込{form.paymentYears}年 +
        据置{form.deferralYears}年）
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="mt-4 w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
      >
        分析する
      </button>
    </div>
  );
}
