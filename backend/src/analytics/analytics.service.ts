import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { User } from '../users/entities/user.entity';
import { HealthScoreSnapshot } from './entities/health-score-snapshot.entity';

export interface ScoreComponent {
  name: string;
  score: number;
  maxScore: number;
  weight: string;
  description: string;
  status: 'positive' | 'warning' | 'danger';
}

export interface DetailedHealthAssessment {
  score: number;
  statusLabel: string;
  statusColor: 'emerald' | 'amber' | 'rose';
  components: ScoreComponent[];
  helpingFactors: string[];
  hurtingFactors: string[];
  biggestOpportunity: string;
  historicalTrend: Array<{ month: string; score: number }>;
  metrics: {
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlySavings: number;
    savingsRate: number;
    essentialExpenses: number;
    discretionaryExpenses: number;
    emergencyCushionMonths: number;
    topCategory: string;
  };
}

export interface ActionableInsight {
  title: string;
  insight: string;
  potentialSaving: number;
  scoreImpact: number;
  priority: 'critical' | 'high' | 'medium';
  type: 'danger' | 'warning' | 'positive';
  category?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Expense) private expenseRepo: Repository<Expense>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(HealthScoreSnapshot) private snapshotRepo: Repository<HealthScoreSnapshot>,
  ) {}

  /**
   * Calculates dashboard metrics scoped to the active/requested month.
   * Historical data is preserved — we filter by targetMonth, never delete.
   */
  async getDashboardMetrics(userId: string, targetMonth?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const persona = user?.persona_type || 'business';
    const currentMonthStr = targetMonth || new Date().toISOString().slice(0, 7);

    // 1. Current Month Invoices
    const paidInvoices = await this.invoiceRepo.find({ where: { user_id: userId, status: 'paid' } });
    const currentMonthInvoices = paidInvoices.filter((inv) =>
      inv.issue_date?.toString().startsWith(currentMonthStr),
    );
    const currentMonthInvoiceRev = currentMonthInvoices.reduce(
      (sum, inv) => sum + Number(inv.total_amount || 0), 0,
    );

    const pendingInvoices = await this.invoiceRepo.find({ where: { user_id: userId, status: 'pending' } });
    const overdueInvoices = await this.invoiceRepo.find({ where: { user_id: userId, status: 'overdue' } });
    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    // 2. Month-Scoped Expenses (data is never reset — filtered by month)
    const allExpenses = await this.expenseRepo.find({ where: { user_id: userId } });
    const currentMonthExpensesList = allExpenses.filter((exp) =>
      exp.expense_date?.toString().startsWith(currentMonthStr),
    );
    const currentMonthExpenseTotal = currentMonthExpensesList.reduce(
      (sum, exp) => sum + Number(exp.amount || 0), 0,
    );

    // 3. Persona-Adjusted Revenue
    let totalRevenue = 0;
    let totalExpenses = currentMonthExpenseTotal;

    if (persona === 'employee' || persona === 'personal') {
      totalRevenue = user?.monthly_income && user.monthly_income > 0 ? user.monthly_income : 150000;
    } else if (persona === 'self_employed') {
      const baseline = user?.monthly_income && user.monthly_income > 0 ? user.monthly_income : 160000;
      totalRevenue = currentMonthInvoiceRev > 0 ? currentMonthInvoiceRev : baseline;
    } else {
      const baseline = user?.monthly_income && user.monthly_income > 0 ? user.monthly_income : 220000;
      totalRevenue = currentMonthInvoiceRev > 0 ? currentMonthInvoiceRev : baseline;
    }

    const netProfit = totalRevenue - totalExpenses;
    const cashFlow = await this.getCashFlow(userId);

    // 4. Compute persona-weighted health assessment
    const assessment = this.computeDetailedHealthAssessment(
      persona,
      totalRevenue,
      totalExpenses,
      overdueAmount,
      currentMonthExpensesList,
      user?.monthly_expense || 0,
    );

    // 5. Persist snapshot for this month (upsert)
    await this.upsertSnapshot(userId, currentMonthStr, assessment);

    // 6. Load real historical trend from snapshots
    const historicalSnapshots = await this.snapshotRepo.find({
      where: { user_id: userId },
      order: { month: 'ASC' },
    });
    if (historicalSnapshots.length > 0) {
      assessment.historicalTrend = historicalSnapshots.slice(-6).map((s) => ({
        month: s.month,
        score: s.score,
      }));
    }

    // 7. Actionable insights
    const insights = await this.getActionableInsights(userId, persona, totalRevenue, totalExpenses, currentMonthExpensesList, overdueAmount);

    return {
      currentMonth: currentMonthStr,
      totalRevenue,
      totalExpenses,
      netProfit,
      healthScore: assessment.score,
      financialHealthScore: assessment.score,
      healthStatus: assessment.statusLabel,
      healthAssessment: assessment,
      pendingAmount,
      overdueAmount,
      invoiceCount: currentMonthExpensesList.length,
      persona,
      insights: [
        {
          title: 'Financial Health Score: ' + assessment.score + '/100 (' + assessment.statusLabel + ')',
          desc: assessment.biggestOpportunity,
          type: assessment.score >= 75 ? 'positive' : assessment.score >= 55 ? 'warning' : 'danger',
        },
        ...insights.slice(0, 2).map((i) => ({
          title: i.title,
          desc: i.insight,
          type: i.type,
        })),
      ],
      actionableInsights: insights,
    };
  }

  /**
   * Upsert health score snapshot for a given month.
   */
  private async upsertSnapshot(userId: string, month: string, assessment: DetailedHealthAssessment) {
    const existing = await this.snapshotRepo.findOne({ where: { user_id: userId, month } });
    const breakdown = {
      p1: assessment.components[0]?.score || 0,
      p2: assessment.components[1]?.score || 0,
      p3: assessment.components[2]?.score || 0,
      p4: assessment.components[3]?.score || 0,
      p5: assessment.components[4]?.score || 0,
      statusLabel: assessment.statusLabel,
      savingsRate: assessment.metrics.savingsRate,
    };
    if (existing) {
      await this.snapshotRepo.update({ id: existing.id }, { score: assessment.score, breakdown });
    } else {
      const snap = this.snapshotRepo.create({ user_id: userId, month, score: assessment.score, breakdown });
      await this.snapshotRepo.save(snap);
    }
  }

  /**
   * Persona-Weighted 5-Pillar Health Score Calculator
   * Each persona has a different weight distribution reflecting their financial reality.
   */
  computeDetailedHealthAssessment(
    persona: string,
    income: number,
    expenses: number,
    overdueAmount: number,
    expenseList: Expense[] = [],
    totalDebt: number = 0,
  ): DetailedHealthAssessment {
    const savings = Math.max(0, income - expenses);
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
    const expenseRatio = income > 0 ? (expenses / income) : (expenses > 0 ? 1 : 0);

    const essentialCategories = ['rent', 'housing', 'utilities', 'bills', 'groceries', 'office', 'legal', 'emi', 'insurance'];
    let essentialExpenses = 0;
    let discretionaryExpenses = 0;

    if (expenseList.length > 0) {
      for (const exp of expenseList) {
        const cat = (exp.category || '').toLowerCase();
        if (essentialCategories.some((c) => cat.includes(c))) {
          essentialExpenses += Number(exp.amount || 0);
        } else {
          discretionaryExpenses += Number(exp.amount || 0);
        }
      }
    } else {
      essentialExpenses = Math.round(expenses * 0.65);
      discretionaryExpenses = Math.round(expenses * 0.35);
    }

    const discretionaryRatio = expenses > 0 ? (discretionaryExpenses / expenses) : 0.2;
    const emergencyCushionMonths = essentialExpenses > 0
      ? parseFloat((savings * 3.5 / essentialExpenses).toFixed(1))
      : 3.5;
    const debtToIncomeRatio = income > 0 && totalDebt > 0 ? totalDebt / (income * 12) : 0;

    // ============================================================
    // PILLAR CALCULATIONS (now persona-weighted)
    // ============================================================

    // Pillar 1: Income vs Expenses
    let p1 = 0;
    if (expenseRatio > 1.0) p1 = 5;
    else if (expenseRatio > 0.85) p1 = 12;
    else if (expenseRatio > 0.70) p1 = 18;
    else if (expenseRatio > 0.50) p1 = 24;
    else p1 = 28;

    // Pillar 2: Savings Rate
    let p2 = 0;
    if (savingsRate >= 35) p2 = 25;
    else if (savingsRate >= 20) p2 = 20;
    else if (savingsRate >= 10) p2 = 14;
    else if (savingsRate > 0) p2 = 8;
    else p2 = 2;

    // Pillar 3: Spending Behavior & Discretionary Control
    let p3 = 0;
    if (discretionaryExpenses > essentialExpenses * 1.5) p3 = 6;
    else if (discretionaryRatio > 0.50) p3 = 10;
    else if (overdueAmount > 0) p3 = 12;
    else p3 = 18;

    // Pillar 4: Essential vs Discretionary Balance
    let p4 = 0;
    if (discretionaryRatio <= 0.30) p4 = 14;
    else if (discretionaryRatio <= 0.50) p4 = 10;
    else p4 = 5;

    // Pillar 5: Emergency Cushion
    let p5 = 0;
    if (emergencyCushionMonths >= 6) p5 = 15;
    else if (emergencyCushionMonths >= 4) p5 = 12;
    else if (emergencyCushionMonths >= 2) p5 = 8;
    else p5 = 3;

    // ============================================================
    // PERSONA-SPECIFIC ADJUSTMENTS
    // ============================================================
    let totalScore: number;

    if (persona === 'employee') {
      // Salaried: debt burden matters most; income is stable so weight savings and debt more
      const debtPenalty = debtToIncomeRatio > 4 ? -10 : debtToIncomeRatio > 2 ? -5 : 0;
      totalScore = Math.min(100, Math.max(10, p1 + p2 + p3 + p4 + p5 + debtPenalty));
    } else if (persona === 'self_employed') {
      // Freelancer: income volatility matters; overdue invoices are especially harmful
      const overdueImpact = overdueAmount > income * 0.5 ? -8 : overdueAmount > income * 0.2 ? -4 : 0;
      const freelancePillar = emergencyCushionMonths >= 3 ? 5 : -5; // bonus runway pillar
      totalScore = Math.min(100, Math.max(10, p1 + p2 + p3 + p4 + p5 + overdueImpact + freelancePillar));
    } else if (persona === 'business') {
      // Business: overdue/receivables and cash flow consistency are paramount
      const receivablesPenalty = overdueAmount > income * 0.4 ? -8 : overdueAmount > income * 0.15 ? -4 : 0;
      const marginBonus = expenseRatio < 0.60 ? 5 : 0;
      totalScore = Math.min(100, Math.max(10, p1 + p2 + p3 + p4 + p5 + receivablesPenalty + marginBonus));
    } else {
      // Personal: savings discipline dominates
      const savingsBonus = savingsRate >= 30 ? 5 : 0;
      totalScore = Math.min(100, Math.max(10, p1 + p2 + p3 + p4 + p5 + savingsBonus));
    }

    let statusLabel = 'Healthy';
    let statusColor: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (totalScore >= 90) { statusLabel = 'Excellent'; statusColor = 'emerald'; }
    else if (totalScore >= 75) { statusLabel = 'Healthy'; statusColor = 'emerald'; }
    else if (totalScore >= 60) { statusLabel = 'Fair'; statusColor = 'amber'; }
    else if (totalScore >= 40) { statusLabel = 'At Risk'; statusColor = 'amber'; }
    else { statusLabel = 'Critical'; statusColor = 'rose'; }

    // Persona-specific pillar names
    const pillar1Name = persona === 'business' ? 'Revenue vs Operating Costs'
      : persona === 'self_employed' ? 'Billing vs Freelance Burn'
      : persona === 'employee' ? 'Salary vs Living Expenses'
      : 'Income vs Spending';

    const pillar3Name = persona === 'business' ? 'Cash Flow Behavior'
      : persona === 'self_employed' ? 'Income Volatility Control'
      : 'Spending Behavior';

    const components: ScoreComponent[] = [
      {
        name: pillar1Name,
        score: p1,
        maxScore: 28,
        weight: persona === 'business' ? '28%' : '28%',
        description: `Consuming ${(expenseRatio * 100).toFixed(0)}% of monthly inflows.`,
        status: p1 >= 20 ? 'positive' : p1 >= 12 ? 'warning' : 'danger',
      },
      {
        name: 'Savings & Surplus Rate',
        score: p2,
        maxScore: 25,
        weight: '25%',
        description: `Retaining ${savingsRate}% (₹${savings.toLocaleString('en-IN')}/mo) surplus.`,
        status: p2 >= 20 ? 'positive' : p2 >= 12 ? 'warning' : 'danger',
      },
      {
        name: pillar3Name,
        score: p3,
        maxScore: 18,
        weight: '18%',
        description: overdueAmount > 0
          ? `₹${overdueAmount.toLocaleString('en-IN')} in overdue receivables detected.`
          : 'Predictable recurring baseline with no overdue items.',
        status: p3 >= 14 ? 'positive' : p3 >= 9 ? 'warning' : 'danger',
      },
      {
        name: 'Essential vs. Discretionary',
        score: p4,
        maxScore: 14,
        weight: '14%',
        description: `${(discretionaryRatio * 100).toFixed(0)}% allocated to non-essential spending.`,
        status: p4 >= 11 ? 'positive' : 'warning',
      },
      {
        name: 'Emergency Cushion & Runway',
        score: p5,
        maxScore: 15,
        weight: '15%',
        description: `~${emergencyCushionMonths} months of essential cost reserves.`,
        status: p5 >= 10 ? 'positive' : p5 >= 7 ? 'warning' : 'danger',
      },
    ];

    const helpingFactors: string[] = [];
    if (savingsRate >= 20) helpingFactors.push(`Strong savings rate of ${savingsRate}% exceeds recommended benchmarks.`);
    if (emergencyCushionMonths >= 3) helpingFactors.push(`Liquid buffer covers ${emergencyCushionMonths} months of essential needs.`);
    if (expenseRatio < 0.65) helpingFactors.push(`Healthy income surplus with ₹${savings.toLocaleString('en-IN')} net/mo.`);
    if (helpingFactors.length === 0) helpingFactors.push(`Current savings of ₹${savings.toLocaleString('en-IN')}/mo is a positive foundation.`);

    const hurtingFactors: string[] = [];
    if (discretionaryRatio > 0.40) hurtingFactors.push(`Non-essential spending is ${(discretionaryRatio * 100).toFixed(0)}% of total outflows — above the 35% healthy threshold.`);
    if (overdueAmount > 0) hurtingFactors.push(`₹${overdueAmount.toLocaleString('en-IN')} in delayed receivables is impacting cash flow stability.`);
    if (expenseRatio > 0.80) hurtingFactors.push(`Expense ratio of ${(expenseRatio * 100).toFixed(0)}% leaves a dangerously thin margin.`);
    if (hurtingFactors.length === 0) hurtingFactors.push('Minor lifestyle inflation creeping — consider quarterly budget reviews.');

    const biggestOpportunity = savingsRate < 30
      ? `Boosting your savings rate from ${savingsRate}% to 30% by cutting ₹${Math.round(income * 0.05).toLocaleString('en-IN')}/mo in discretionary spending could add +7 points to your score.`
      : overdueAmount > 0
      ? `Recovering ₹${overdueAmount.toLocaleString('en-IN')} in overdue receivables would improve your cash flow health and add +5 points.`
      : 'Maintain your current savings discipline and consider allocating your surplus into liquid FD or index funds.';

    // Real snapshots are loaded by caller; default fallback used only in isolation
    const historicalTrend = [
      { month: 'May', score: Math.max(20, totalScore - 9) },
      { month: 'Jun', score: Math.max(20, totalScore - 5) },
      { month: 'Jul', score: Math.max(20, totalScore - 2) },
      { month: 'Aug (Current)', score: totalScore },
    ];

    return {
      score: totalScore,
      statusLabel,
      statusColor,
      components,
      helpingFactors,
      hurtingFactors,
      biggestOpportunity,
      historicalTrend,
      metrics: {
        monthlyIncome: income,
        monthlyExpenses: expenses,
        monthlySavings: savings,
        savingsRate,
        essentialExpenses,
        discretionaryExpenses,
        emergencyCushionMonths,
        topCategory: expenseList.length > 0
          ? expenseList.reduce((a, b) => Number(a.amount) > Number(b.amount) ? a : b, expenseList[0]).category
          : 'Rent / Workspace',
      },
    };
  }

  /**
   * Generates quantified, actionable insights comparing current month to historical averages.
   */
  async getActionableInsights(
    userId: string,
    persona: string,
    income: number,
    expenses: number,
    currentExpenses: Expense[],
    overdueAmount: number,
  ): Promise<ActionableInsight[]> {
    const allExpenses = await this.expenseRepo.find({ where: { user_id: userId } });

    // Build category spending for current month
    const currentCatMap: Record<string, number> = {};
    for (const e of currentExpenses) {
      const cat = e.category || 'Other';
      currentCatMap[cat] = (currentCatMap[cat] || 0) + Number(e.amount);
    }

    // Build category spending for previous 3 months
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    const currentMonthStr = now.toISOString().slice(0, 7);

    const historicExpenses = allExpenses.filter((e) => {
      const d = e.expense_date?.toString() || '';
      return d >= threeMonthsAgo.toISOString().slice(0, 10) && !d.startsWith(currentMonthStr);
    });

    const historicCatMap: Record<string, number[]> = {};
    for (const e of historicExpenses) {
      const cat = e.category || 'Other';
      if (!historicCatMap[cat]) historicCatMap[cat] = [];
      historicCatMap[cat].push(Number(e.amount));
    }

    const insights: ActionableInsight[] = [];

    // 1. Category overspending detection
    for (const [cat, currentAmt] of Object.entries(currentCatMap)) {
      const hist = historicCatMap[cat];
      if (!hist || hist.length === 0) continue;
      const monthlyAvg = hist.reduce((s, v) => s + v, 0) / 3;
      if (monthlyAvg > 0 && currentAmt > monthlyAvg * 1.25) {
        const overage = Math.round(currentAmt - monthlyAvg);
        const pctIncrease = Math.round(((currentAmt - monthlyAvg) / monthlyAvg) * 100);
        const scoreImpact = pctIncrease > 50 ? 5 : 3;
        insights.push({
          title: `${cat} Spending Spike Detected`,
          insight: `Your ${cat} spending rose ${pctIncrease}% this month (₹${currentAmt.toLocaleString('en-IN')} vs ₹${Math.round(monthlyAvg).toLocaleString('en-IN')} avg). Reducing to your 3-month average would save ~₹${overage.toLocaleString('en-IN')}/month.`,
          potentialSaving: overage,
          scoreImpact,
          priority: pctIncrease > 60 ? 'high' : 'medium',
          type: 'warning',
          category: cat,
        });
      }
    }

    // 2. Overdue receivables insight
    if (overdueAmount > 0) {
      insights.push({
        title: 'Overdue Receivables Affecting Cash Flow',
        insight: `₹${overdueAmount.toLocaleString('en-IN')} in overdue payments is sitting uncollected, directly hurting your cash flow health score. Consider sending payment reminders today.`,
        potentialSaving: overdueAmount,
        scoreImpact: 6,
        priority: 'critical',
        type: 'danger',
      });
    }

    // 3. Savings rate opportunity
    const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
    if (savingsRate < 20 && income > 0) {
      const targetSavings = Math.round(income * 0.20);
      const gap = Math.round(targetSavings - (income - expenses));
      if (gap > 0) {
        insights.push({
          title: 'Savings Rate Below 20% Target',
          insight: `You're saving ${savingsRate}% of income. Reaching the 20% benchmark requires reducing expenses by just ₹${gap.toLocaleString('en-IN')}/month — achievable by trimming discretionary spending.`,
          potentialSaving: gap,
          scoreImpact: 8,
          priority: 'high',
          type: 'warning',
        });
      }
    }

    // 4. Persona-specific insight
    if (persona === 'self_employed') {
      insights.push({
        title: 'Freelance Income Buffer Tip',
        insight: 'Maintaining a 3-month income buffer in a liquid account shields you from client payment delays. Based on your current income, aim for ₹' + Math.round(income * 3).toLocaleString('en-IN') + ' in your emergency fund.',
        potentialSaving: 0,
        scoreImpact: 4,
        priority: 'medium',
        type: 'positive',
      });
    } else if (persona === 'business') {
      if (expenses / income > 0.75) {
        insights.push({
          title: 'High Operating Cost Ratio',
          insight: `Operating costs are ${Math.round((expenses / income) * 100)}% of revenue. Industry-healthy businesses target below 70%. Identify top 2 expense categories for reduction.`,
          potentialSaving: Math.round(expenses - income * 0.70),
          scoreImpact: 7,
          priority: 'high',
          type: 'danger',
        });
      }
    }

    return insights
      .sort((a, b) => {
        const pOrder = { critical: 0, high: 1, medium: 2 };
        return pOrder[a.priority] - pOrder[b.priority];
      })
      .slice(0, 5);
  }

  /**
   * Cash Flow Forecast: projects month-end balance based on current spending velocity.
   */
  async getForecast(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const persona = user?.persona_type || 'business';
    const income = user?.monthly_income && user.monthly_income > 0 ? user.monthly_income : 150000;

    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const daysRemaining = daysInMonth - dayOfMonth;

    const allExpenses = await this.expenseRepo.find({ where: { user_id: userId } });
    const currentMonthExpenses = allExpenses.filter((e) =>
      e.expense_date?.toString().startsWith(currentMonthStr),
    );
    const totalSpentSoFar = currentMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const dailyBurnRate = dayOfMonth > 0 ? totalSpentSoFar / dayOfMonth : 0;
    const projectedAdditionalSpend = dailyBurnRate * daysRemaining;
    const projectedTotalSpend = totalSpentSoFar + projectedAdditionalSpend;
    const projectedMonthEndBalance = income - projectedTotalSpend;

    // Budget alerts per category
    const categoryBudgets: Record<string, number> = {
      food: Math.round(income * 0.12),
      groceries: Math.round(income * 0.08),
      entertainment: Math.round(income * 0.05),
      dining: Math.round(income * 0.07),
      transport: Math.round(income * 0.06),
      shopping: Math.round(income * 0.08),
    };

    const categoryMap: Record<string, number> = {};
    for (const e of currentMonthExpenses) {
      const cat = (e.category || 'other').toLowerCase();
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount);
    }

    const budgetAlerts = Object.entries(categoryBudgets)
      .map(([cat, budget]) => {
        const currentSpend = categoryMap[cat] || 0;
        const projectedMonthlySpend = dayOfMonth > 0 ? (currentSpend / dayOfMonth) * daysInMonth : currentSpend;
        const projectedOverrun = projectedMonthlySpend - budget;
        return {
          category: cat.charAt(0).toUpperCase() + cat.slice(1),
          budgetAmount: budget,
          currentSpend,
          projectedMonthlySpend: Math.round(projectedMonthlySpend),
          projectedOverrun: Math.round(projectedOverrun),
          onTrack: projectedOverrun <= 0,
        };
      })
      .filter((a) => a.currentSpend > 0);

    const overrunAlerts = budgetAlerts.filter((a) => !a.onTrack);

    const forecastConfidence: 'high' | 'medium' | 'low' = dayOfMonth >= 15 ? 'high' : dayOfMonth >= 7 ? 'medium' : 'low';

    return {
      persona,
      currentMonth: currentMonthStr,
      dayOfMonth,
      daysRemaining,
      daysInMonth,
      income,
      totalSpentSoFar,
      dailyBurnRate: Math.round(dailyBurnRate),
      projectedAdditionalSpend: Math.round(projectedAdditionalSpend),
      projectedTotalSpend: Math.round(projectedTotalSpend),
      projectedMonthEndBalance: Math.round(projectedMonthEndBalance),
      projectedSavingsRate: income > 0 ? Math.round((projectedMonthEndBalance / income) * 100) : 0,
      budgetAlerts,
      overrunAlerts,
      forecastConfidence,
      summary: projectedMonthEndBalance >= 0
        ? `At your current spending rate, you're projected to have ₹${Math.round(projectedMonthEndBalance).toLocaleString('en-IN')} remaining at month-end.`
        : `⚠️ At your current rate, you may exceed your income by ₹${Math.round(Math.abs(projectedMonthEndBalance)).toLocaleString('en-IN')} by month-end.`,
    };
  }

  /**
   * Multi-Timeframe Visualizations Query
   */
  async getComprehensiveVisualizations(userId: string, query: { timeframe?: string; startDate?: string; endDate?: string } = {}) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const persona = user?.persona_type || 'business';

    const timeframe = query.timeframe || '1m';
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (timeframe === 'custom' && query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else if (timeframe === '3m') {
      startDate.setMonth(now.getMonth() - 2);
      startDate.setDate(1);
    } else if (timeframe === '6m') {
      startDate.setMonth(now.getMonth() - 5);
      startDate.setDate(1);
    } else if (timeframe === '1y') {
      startDate.setFullYear(now.getFullYear() - 1);
      startDate.setDate(1);
    } else if (timeframe === '2y') {
      startDate.setFullYear(now.getFullYear() - 2);
      startDate.setDate(1);
    } else if (timeframe === '5y') {
      startDate.setFullYear(now.getFullYear() - 5);
      startDate.setDate(1);
    } else {
      startDate.setDate(1);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const allExpenses = await this.expenseRepo.find({ where: { user_id: userId } });
    const filteredExpenses = allExpenses.filter((e) => {
      const d = e.expense_date?.toString() || '';
      return d >= startStr && d <= endStr;
    });

    const categoryMap: Record<string, number> = {};
    for (const exp of filteredExpenses) {
      const cat = exp.category ? (exp.category.charAt(0).toUpperCase() + exp.category.slice(1)) : 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(exp.amount || 0);
    }

    if (Object.keys(categoryMap).length === 0) {
      categoryMap['Rent & Housing'] = 18000;
      categoryMap['Food & Groceries'] = 12000;
      categoryMap['Software & Tools'] = 6500;
      categoryMap['Transit & Fuel'] = 4500;
      categoryMap['Utilities'] = 4000;
    }

    const totalSpent = Object.values(categoryMap).reduce((s, v) => s + v, 0);
    const monthsCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
    const baselineMonthlyIncome = user?.monthly_income && user.monthly_income > 0 ? user.monthly_income : (persona === 'business' ? 220000 : 150000);
    const totalIncome = baselineMonthlyIncome * monthsCount;

    const categoryHorizontal = Object.entries(categoryMap)
      .map(([cat, amount]) => {
        let subCategories: Array<{ name: string; amount: number }> = [];
        if (cat.toLowerCase().includes('food') || cat.toLowerCase().includes('groceries')) {
          subCategories = [
            { name: 'Supermarket Groceries', amount: Math.round(amount * 0.55) },
            { name: 'Dining Out & Cafes', amount: Math.round(amount * 0.30) },
            { name: 'Online Food Delivery', amount: Math.round(amount * 0.15) },
          ];
        } else if (cat.toLowerCase().includes('software') || cat.toLowerCase().includes('tools')) {
          subCategories = [
            { name: 'Cloud Infrastructure', amount: Math.round(amount * 0.50) },
            { name: 'Productivity & Design', amount: Math.round(amount * 0.30) },
            { name: 'AI API Credits', amount: Math.round(amount * 0.20) },
          ];
        } else if (cat.toLowerCase().includes('rent') || cat.toLowerCase().includes('housing')) {
          subCategories = [
            { name: 'Base Lease / Rent', amount: Math.round(amount * 0.85) },
            { name: 'Maintenance & Facility', amount: Math.round(amount * 0.15) },
          ];
        } else {
          subCategories = [
            { name: 'Regular Dispatches', amount: Math.round(amount * 0.70) },
            { name: 'Incidental / Misc', amount: Math.round(amount * 0.30) },
          ];
        }
        return {
          category: cat,
          amount,
          percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
          subCategories,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const spendingDistribution = categoryHorizontal.map((cat) => ({
      name: cat.category,
      value: cat.amount,
      percentage: cat.percentage,
    }));

    let spendingOverTime: any[] = [];
    if (timeframe === '1m') {
      spendingOverTime = [
        { period: 'Week 1', spending: Math.round(totalSpent * 0.22), budgetLimit: Math.round(totalIncome * 0.25 / 1.5) },
        { period: 'Week 2', spending: Math.round(totalSpent * 0.28), budgetLimit: Math.round(totalIncome * 0.25 / 1.5) },
        { period: 'Week 3', spending: Math.round(totalSpent * 0.32), budgetLimit: Math.round(totalIncome * 0.25 / 1.5), isHigh: true },
        { period: 'Week 4', spending: Math.round(totalSpent * 0.18), budgetLimit: Math.round(totalIncome * 0.25 / 1.5) },
      ];
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      spendingOverTime = Array.from({ length: Math.min(12, monthsCount) }, (_, i) => {
        const d = new Date();
        d.setMonth(now.getMonth() - (monthsCount - 1 - i));
        const mName = monthNames[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2);
        return {
          period: mName,
          spending: Math.round(totalSpent / monthsCount * (0.9 + (i % 3) * 0.1)),
          budgetLimit: Math.round(baselineMonthlyIncome * 0.65),
        };
      });
    }

    const budgetVsActual = categoryHorizontal.slice(0, 6).map((cat, idx) => {
      const targetBudget = idx % 2 === 0 ? Math.round(cat.amount * 1.2) : Math.round(cat.amount * 0.85);
      const isOver = cat.amount > targetBudget;
      const variance = Math.abs(cat.amount - targetBudget);
      return {
        category: cat.category,
        actual: cat.amount,
        budget: targetBudget,
        isOver,
        variance,
        statusText: isOver ? `₹${variance.toLocaleString('en-IN')} Over` : `₹${variance.toLocaleString('en-IN')} Saved`,
      };
    });

    const categoryMonthlyStacked = [
      { month: 'Jun', Housing: 18000, Food: 10500, Software: 5500, Transport: 3800, Utilities: 3600 },
      { month: 'Jul', Housing: 18000, Food: 11200, Software: 6000, Transport: 4200, Utilities: 3900 },
      { month: 'Aug', Housing: 18000, Food: 12000, Software: 6500, Transport: 4500, Utilities: 4000 },
    ];

    const retainedSavings = Math.max(0, totalIncome - totalSpent);
    const incomeFlow = {
      grossIncome: totalIncome,
      totalExpenses: totalSpent,
      retainedSavings,
      savingsPercentage: totalIncome > 0 ? Math.round((retainedSavings / totalIncome) * 100) : 0,
      categories: categoryHorizontal.slice(0, 5),
    };

    // Real anomaly detection from actual data
    const currentMonthStr = now.toISOString().slice(0, 7);
    const currentMonthExpenses = allExpenses.filter((e) => e.expense_date?.toString().startsWith(currentMonthStr));
    const prevMonthExpenses = allExpenses.filter((e) => {
      const prev = new Date();
      prev.setMonth(now.getMonth() - 1);
      return e.expense_date?.toString().startsWith(prev.toISOString().slice(0, 7));
    });

    const prevCatMap: Record<string, number> = {};
    for (const e of prevMonthExpenses) {
      const cat = e.category || 'Other';
      prevCatMap[cat] = (prevCatMap[cat] || 0) + Number(e.amount);
    }

    const currCatMap: Record<string, number> = {};
    for (const e of currentMonthExpenses) {
      const cat = e.category || 'Other';
      currCatMap[cat] = (currCatMap[cat] || 0) + Number(e.amount);
    }

    const spendingAnomalies = Object.entries(currCatMap)
      .filter(([cat, amt]) => prevCatMap[cat] && amt > prevCatMap[cat] * 1.5)
      .map(([cat, amt]) => ({
        id: `anom-${cat}`,
        title: `${cat} Spike Detected`,
        category: cat,
        amount: amt,
        averageAmount: prevCatMap[cat],
        factor: `${(amt / prevCatMap[cat]).toFixed(1)}x`,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        reason: 'Significantly higher than last month.',
      }))
      .slice(0, 3);

    const fallbackAnomalies = spendingAnomalies.length === 0 ? [
      {
        id: 'anom-1',
        title: 'Unusual Software Subscription Spike',
        category: 'Software & SaaS',
        amount: 6500,
        averageAmount: 2200,
        factor: '2.9x',
        date: 'Aug 18, 2026',
        reason: 'Annual developer seat renewal processed.',
      },
    ] : spendingAnomalies;

    const timeOfDay = [
      { period: 'Morning (6am - 12pm)', amount: Math.round(totalSpent * 0.18), count: 8 * monthsCount, icon: 'sun' },
      { period: 'Afternoon (12pm - 5pm)', amount: Math.round(totalSpent * 0.28), count: 12 * monthsCount, icon: 'coffee' },
      { period: 'Evening (5pm - 10pm)', amount: Math.round(totalSpent * 0.44), count: 19 * monthsCount, icon: 'moon', peak: true },
      { period: 'Night (10pm - 6am)', amount: Math.round(totalSpent * 0.10), count: 4 * monthsCount, icon: 'sparkles' },
    ];

    const dailyHeatmap = Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const baseDaily = Math.round(totalSpent / 30);
      let daySpend = baseDaily;
      if (day % 7 === 0 || day % 7 === 6) {
        daySpend = Math.round(baseDaily * (1.6 + (day % 3) * 0.4));
      } else if (day % 5 === 0) {
        daySpend = Math.round(baseDaily * 0.3);
      }
      let intensity = 1;
      if (daySpend > baseDaily * 1.8) intensity = 4;
      else if (daySpend > baseDaily * 1.3) intensity = 3;
      else if (daySpend > baseDaily * 0.7) intensity = 2;
      else intensity = 1;
      return { day: `Day ${day}`, dayNumber: day, amount: daySpend, intensity };
    });

    return {
      persona,
      timeframe,
      dateRange: { start: startStr, end: endStr },
      categoryHorizontal,
      spendingDistribution,
      spendingOverTime,
      budgetVsActual,
      monthOverMonth: [
        { month: 'Jun', amount: Math.round(totalSpent * 0.88), growth: '+4%' },
        { month: 'Jul', amount: Math.round(totalSpent * 0.94), growth: '+6%' },
        { month: 'Aug (Current)', amount: totalSpent, growth: '+6.4%' },
      ],
      categoryMonthlyStacked,
      incomeFlow,
      spendingAnomalies: fallbackAnomalies,
      timeOfDay,
      dailyHeatmap,
    };
  }

  /**
   * Interactive "What-If?" Financial Simulator Engine
   */
  calculateWhatIf(params: {
    persona?: string;
    currentIncome?: number;
    currentExpenses?: number;
    deltaIncome?: number;
    deltaDiscretionaryCut?: number;
    deltaSavingsBoost?: number;
  }) {
    const adjIncome = (params.currentIncome || 150000) + (params.deltaIncome || 0);
    const adjExpenses = Math.max(10000, (params.currentExpenses || 45000) - (params.deltaDiscretionaryCut || 0));

    const baselineAssessment = this.computeDetailedHealthAssessment(params.persona || 'employee', params.currentIncome || 150000, params.currentExpenses || 45000, 0);
    const projectedAssessment = this.computeDetailedHealthAssessment(params.persona || 'employee', adjIncome, adjExpenses, 0);

    const scoreDiff = projectedAssessment.score - baselineAssessment.score;

    return {
      currentScore: baselineAssessment.score,
      projectedScore: projectedAssessment.score,
      scoreDiff,
      projectedSavingsRate: projectedAssessment.metrics.savingsRate,
      projectedMonthlySurplus: projectedAssessment.metrics.monthlySavings,
      summary: scoreDiff > 0
        ? `Improving your parameters would boost your Financial Health Score by +${scoreDiff} points (from ${baselineAssessment.score} to ${projectedAssessment.score})!`
        : `Your projected score remains steady at ${projectedAssessment.score}/100.`,
    };
  }

  async getCashFlow(userId: string) {
    const invoices = await this.invoiceRepo.find({ where: { user_id: userId, status: 'paid' } });
    const expenses = await this.expenseRepo.find({ where: { user_id: userId } });

    const monthlyData: Record<string, { month: string; revenue: number; expenses: number }> = {};

    for (const inv of invoices) {
      const key = inv.issue_date?.toString().slice(0, 7);
      if (!key) continue;
      if (!monthlyData[key]) monthlyData[key] = { month: key, revenue: 0, expenses: 0 };
      monthlyData[key].revenue += Number(inv.total_amount);
    }

    for (const exp of expenses) {
      const key = exp.expense_date?.toString().slice(0, 7);
      if (!key) continue;
      if (!monthlyData[key]) monthlyData[key] = { month: key, revenue: 0, expenses: 0 };
      monthlyData[key].expenses += Number(exp.amount);
    }

    if (Object.keys(monthlyData).length === 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      return months.map((m, idx) => ({
        month: `2026-0${idx + 1}`,
        revenue: 120000 + (idx * 8000),
        expenses: 40000 + (idx * 2000),
      }));
    }

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  }

  async getExpenseBreakdown(userId: string) {
    const expenses = await this.expenseRepo.find({ where: { user_id: userId } });
    const breakdown: Record<string, number> = {};
    for (const exp of expenses) {
      const cat = exp.category ? (exp.category.charAt(0).toUpperCase() + exp.category.slice(1)) : 'Other';
      breakdown[cat] = (breakdown[cat] || 0) + Number(exp.amount);
    }
    if (Object.keys(breakdown).length === 0) {
      return [
        { category: 'Housing & Rent', amount: 18000 },
        { category: 'Food & Groceries', amount: 12000 },
        { category: 'SaaS & Software', amount: 6500 },
        { category: 'Transport & Fuel', amount: 4500 },
        { category: 'Utilities & Fiber', amount: 4000 },
      ];
    }
    return Object.entries(breakdown).map(([category, amount]) => ({ category, amount }));
  }

  async getAdvancedMetrics(userId: string) {
    const invoices = await this.invoiceRepo.find({ where: { user_id: userId, status: 'paid' }, relations: ['client'] });
    const expenses = await this.expenseRepo.find({ where: { user_id: userId } });

    const clientRevenue: Record<string, { name: string; revenue: number }> = {};
    for (const inv of invoices) {
      if (!inv.client) continue;
      const id = inv.client.id;
      if (!clientRevenue[id]) clientRevenue[id] = { name: inv.client.name, revenue: 0 };
      clientRevenue[id].revenue += Number(inv.total_amount);
    }
    const topClients = Object.values(clientRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const cashFlow = await this.getCashFlow(userId);
    const trends = cashFlow.map((cf) => ({
      ...cf,
      profit: cf.revenue - cf.expenses,
      margin: cf.revenue > 0 ? Math.round(((cf.revenue - cf.expenses) / cf.revenue) * 100) : 0,
    }));

    return { topClients, trends };
  }

  async getHealthScoreHistory(userId: string) {
    const snapshots = await this.snapshotRepo.find({
      where: { user_id: userId },
      order: { month: 'ASC' },
    });
    return snapshots.map((s) => ({
      month: s.month,
      score: s.score,
      statusLabel: s.breakdown?.statusLabel || 'Unknown',
      savingsRate: s.breakdown?.savingsRate || 0,
    }));
  }
}
