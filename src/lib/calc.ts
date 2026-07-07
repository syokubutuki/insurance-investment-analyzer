// 年率換算・IRR・比較計算ユーティリティ

/** 一括払いの複利年率を計算 */
export function annualRateFromReturnRatio(
  returnRatio: number,
  years: number
): number {
  return Math.pow(returnRatio, 1 / years) - 1;
}

/** 分割払い（月払い/年払い）のIRR計算（Newton-Raphson法） */
export function calculateIRR(
  cashflows: number[],
  guess = 0.05,
  maxIter = 1000,
  tolerance = 1e-10
): number {
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashflows[t] / denom;
      dnpv -= (t * cashflows[t]) / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(npv) < tolerance) return rate;
    if (dnpv === 0) return NaN;
    rate -= npv / dnpv;
    if (!isFinite(rate)) return NaN;
  }
  return rate;
}

/**
 * 月払いのキャッシュフロー配列を生成。
 * 保険料は契約開始時点から各月初(index 0..paymentMonths-1)に払い込み、
 * 満期金は運用終了時点(index totalMonths)に受け取る。
 * ※満期を index totalMonths（配列長 totalMonths+1）に置くことで、
 *   受取が1期早くなる off-by-one を回避している。
 */
export function buildMonthlyCashflows(
  monthlyPremium: number,
  paymentMonths: number,
  totalMonths: number,
  receivedAmount: number
): number[] {
  const cfs: number[] = new Array(totalMonths + 1).fill(0);
  for (let m = 0; m < paymentMonths; m++) {
    cfs[m] = -monthlyPremium;
  }
  cfs[totalMonths] += receivedAmount;
  return cfs;
}

/**
 * 年払いのキャッシュフロー配列を生成。
 * 保険料は各年初(index 0..paymentYears-1)、満期金は満了時点(index totalYears)。
 */
export function buildYearlyCashflows(
  yearlyPremium: number,
  paymentYears: number,
  totalYears: number,
  receivedAmount: number
): number[] {
  const cfs: number[] = new Array(totalYears + 1).fill(0);
  for (let y = 0; y < paymentYears; y++) {
    cfs[y] = -yearlyPremium;
  }
  cfs[totalYears] += receivedAmount;
  return cfs;
}

/** 複利で運用した場合の資産推移 */
export function compoundGrowth(
  principal: number,
  annualRate: number,
  years: number
): { year: number; amount: number }[] {
  const result: { year: number; amount: number }[] = [];
  for (let y = 0; y <= years; y++) {
    result.push({
      year: y,
      amount: principal * Math.pow(1 + annualRate, y),
    });
  }
  return result;
}

/** 定額積立の複利運用推移 */
export function compoundGrowthWithContributions(
  yearlyContribution: number,
  annualRate: number,
  contributionYears: number,
  totalYears: number
): { year: number; amount: number }[] {
  const result: { year: number; amount: number }[] = [{ year: 0, amount: 0 }];
  let balance = 0;
  for (let y = 1; y <= totalYears; y++) {
    if (y <= contributionYears) {
      balance = (balance + yearlyContribution) * (1 + annualRate);
    } else {
      balance = balance * (1 + annualRate);
    }
    result.push({ year: y, amount: balance });
  }
  return result;
}

/** 為替変動を考慮した円建てリターンシミュレーション */
export function simulateWithFx(
  dollarReturnRatio: number,
  entryRate: number,
  exitRate: number,
  totalPremiumJPY: number
): {
  dollarAmount: number;
  yenAmount: number;
  yenReturn: number;
  yenReturnRatio: number;
} {
  const dollarAmount = (totalPremiumJPY / entryRate) * dollarReturnRatio;
  const yenAmount = dollarAmount * exitRate;
  return {
    dollarAmount,
    yenAmount,
    yenReturn: yenAmount - totalPremiumJPY,
    yenReturnRatio: yenAmount / totalPremiumJPY,
  };
}

/** 損益分岐為替レートを計算 */
export function breakEvenRate(
  entryRate: number,
  dollarReturnRatio: number
): number {
  return entryRate / dollarReturnRatio;
}

/** 税引後リターン（一時所得） */
export function afterTaxReturnInsurance(
  premium: number,
  received: number
): number {
  const gain = received - premium;
  if (gain <= 500000) return received;
  const taxableIncome = (gain - 500000) / 2;
  // 所得税率は個人の所得次第だが、概算20%+住民税10%で計算
  return received - taxableIncome * 0.3;
}

/** 税引後リターン（NISA=非課税） */
export function afterTaxReturnNISA(
  _premium: number,
  received: number
): number {
  return received;
}

/** 税引後リターン（通常課税 20.315%） */
export function afterTaxReturnNormal(
  premium: number,
  received: number
): number {
  const gain = received - premium;
  if (gain <= 0) return received;
  return received - gain * 0.20315;
}
