# 保険 vs 投資 比較検証ツール（insurance-investment-analyzer）

ドル建てなどの貯蓄型保険を「投資商品」として客観的に評価するための Web アプリです。
保険営業から提示される数字（例：「10 年後に 118%」）を分解・検証し、NISA や国債など
他の資産運用手段と同じ土俵で比較できるようにします。

姉妹ツール：[明治安田生命 保険 分析ページ](https://github.com/syokubutuki/meijiyasuda-insurance)（単一 HTML の商品カタログ＋電卓）。
本アプリはそれをさらに進め、**実為替データ API を使った本格的な数値検証**に特化しています。

## 主な機能

| 機能 | 内容 |
|---|---|
| **年率換算** | 返戻率（例 118%）を複利年率（IRR）に変換。一括は幾何平均、分割払いは Newton-Raphson 法で IRR を算出 |
| **為替リスク分析** | Frankfurter API（ECB, 無料・キー不要）で 1999 年〜現在の USD/JPY を取得し、過去の任意時点で加入したケースを全期間スライド集計。損益分岐レート・最悪／中央／最良ケースを表示 |
| **他商品比較** | 同一条件（金額・期間）で国債・定期預金・インデックス投資・新 NISA と最終資産額を横並び比較。税制の違い（一時所得 / NISA 非課税 / 通常 20.315%）を考慮 |
| **コスト分析** | 為替手数料・解約控除・保障コスト等を積み上げ表示し、「見かけの利回り」と「実質利回り」の差を可視化 |

## 技術スタック

- Next.js 16 (App Router, Turbopack) / React 19 / TypeScript
- Tailwind CSS v4
- Recharts（グラフ描画）
- 為替データ: [Frankfurter API](https://www.frankfurter.app/)（ECB、無料、キー不要）

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
```

## ビルド

```bash
npm run build
npm run start
```

## 免責

本ツールは投資判断のための参考情報を提供するものであり、特定の金融商品の推奨・勧誘を
目的としたものではありません。計算結果はすべて概算値です。
