export interface SampleContractMeta {
  id: string;
  title: string;
  institution: string;
  type: string;
  borrower: string;
  sanctionedAmount: number;
  rate: number;
  tenureMonths: number;
  filename: string;
  description: string;
  text: string;
  benchmarks: string[];
}

export const SAMPLE_CONTRACT_UJJIVAN: SampleContractMeta = {
  id: 'ujjivan-mse',
  title: 'Ujjivan Small Finance Bank — MSE Secured Business Loan',
  institution: 'Ujjivan Small Finance Bank Limited',
  type: 'Commercial MSE Term Loan',
  borrower: 'Apex Dynamics Precision Engineering Pvt Ltd',
  sanctionedAmount: 7500000,
  rate: 12.75,
  tenureMonths: 60,
  filename: 'ujjivan_mse_loan_agreement.txt',
  description: 'MSE commercial loan facility with hypothecation of CNC machinery, floating MCLR spread, 60-month tenure, 3.5% foreclosure fee, and personal guarantees.',
  benchmarks: [
    'Unilateral Floating MCLR Spread (+3.5%)',
    'Unconditional Personal Real Estate Guarantee',
    '3.5% Prepayment Foreclosure Penalty',
    'Paramount Right of Set-Off across all Bank Accounts',
    'SARFAESI Repossession on 7-Day Default Notice'
  ],
  text: `UJJIVAN SMALL FINANCE BANK LIMITED
MICRO AND SMALL ENTERPRISES (MSE) SECURED BUSINESS LOAN AGREEMENT

SANCTION DETAILS & FACILITY AGREEMENT
Contract Reference No: USFB/MSE/2024/BL-89421
Date of Execution: October 14, 2024
Place: Bangalore, Karnataka

PARTIES TO THE AGREEMENT:
1. LENDER: UJJIVAN SMALL FINANCE BANK LIMITED, a banking company incorporated under the Companies Act, 2013 and licensed under the Banking Regulation Act, 1949, having its Registered Office at Grape Garden, No. 27, 3rd A Cross, 18th Main, 6th Block, Koramangala, Bengaluru - 560095 (hereinafter referred to as the "Lender" or "Bank").
2. BORROWER: APEX DYNAMICS PRECISION ENGINEERING PRIVATE LIMITED, a private limited company incorporated under the laws of India, represented by its Managing Director, Rajesh S. Menon (hereinafter referred to as the "Borrower").
3. GUARANTOR: RAJESH S. MENON and PRIYA R. MENON, individuals residing at No. 42, Palm Meadows, Whitefield, Bengaluru (hereinafter collectively referred to as the "Guarantor").

SECTION 1: SANCTIONED LOAN AMOUNT & DISBURSEMENT
1.1 The Lender agrees to lend and advance to the Borrower, and the Borrower agrees to borrow from the Lender, a term loan facility of ₹75,00,000 (Indian Rupees Seventy-Five Lakhs Only) for the purpose of commercial capital expenditure, modernization of machinery, and working capital augmentation.
1.2 The loan shall be disbursed in a single tranche into the Borrower's designated Current Account No. 008920194821 maintained with the Lender, net of upfront processing fees and statutory stamp duty.

SECTION 2: INTEREST RATE, BENCHMARK & REPRICING
2.1 The Borrower shall pay interest on the outstanding principal balance at an initial floating rate of 12.75% per annum, computed on a daily reducing balance method and payable monthly.
2.2 The interest rate is linked to the Lender's Marginal Cost of Funds Based Lending Rate (MCLR-1Y) currently at 9.25% plus a spread/margin of 3.50% p.a.
2.3 UNILATERAL RATE REVISION: The Lender reserves the absolute right and sole discretion to revise, vary, or alter the benchmark spread, margins, or the applicable rate of interest from time to time based on monetary policy directives or internal credit assessment without requiring the prior consent of the Borrower. Such revised interest rate shall become binding upon 7 days of notice posted on the Lender's website.

SECTION 3: AMORTIZATION & REPAYMENT SCHEDULE
3.1 The loan shall be repaid across a total tenure of 60 months (5 years) through 60 Equated Monthly Installments (EMIs) of approximately ₹1,69,690/- each.
3.2 Repayments shall commence on the 5th day of December 2024 via mandatory National Automated Clearing House (NACH) mandate or Electronic Clearing Service (ECS).
3.3 MORATORIUM: A principal moratorium period of 3 months is permitted from disbursement; however, simple interest during the moratorium must be serviced on the 5th of each calendar month.

SECTION 4: PREPAYMENT & FORECLOSURE CHARGES
4.1 The Borrower shall not prepay or foreclose the facility during an initial lock-in period of 12 months from the disbursement date.
4.2 After the expiry of the lock-in period, early partial prepayment or complete foreclosure shall be subject to a Prepayment Penalty of 3.50% plus applicable Goods and Services Tax (GST) on the outstanding principal amount prepaid.

SECTION 5: HYPOTHECATION & SECURITY CHARGE
5.1 As security for the prompt repayment of the facility, the Borrower hereby hypothecates and creates a first exclusive floating charge in favor of the Lender over all existing and future plant, CNC machinery, factory equipment, raw materials, work-in-progress, and book debts located at Plot 12B, Peenya Industrial Area, Bengaluru.
5.2 The Borrower warrants not to create any negative lien, encumbrance, pledge, or second charge over the hypothecated assets in favor of any other bank or financial institution without the prior written approval of the Lender.

SECTION 6: UNCONDITIONAL PERSONAL GUARANTEE
6.1 The Guarantors unconditionally, irrevocably, jointly, and severally guarantee the due and punctual payment of the principal amount, interest, default charges, and legal fees.
6.2 The liability of the Guarantors shall be primary and continuous. The Lender shall have the full right to proceed against the personal property, residential real estate, personal savings accounts, and private assets of the Guarantors without being required to first exhaust remedies against the primary Borrower or the hypothecated machinery.

SECTION 7: RIGHT OF SET-OFF & CONSOLIDATION OF ACCOUNTS
7.1 The Lender shall have a paramount lien and the right of set-off on all monies, fixed deposits, securities, and current account balances standing to the credit of the Borrower or Guarantors in any branch or subsidiary of the Lender.
7.2 The Bank may, without prior notice, combine or consolidate accounts and apply credit balances to satisfy any overdue interest, installment, or acceleration demand.

SECTION 8: EVENTS OF DEFAULT & ACCELERATION
8.1 Each of the following shall constitute an Event of Default:
  (a) Failure to pay any EMI, interest, or charges on or before the due date.
  (b) Breach of any financial covenant or negative lien warranty.
  (c) Any cross-default wherein the Borrower or Guarantor defaults on any other debt, credit facility, or statutory liability with any other creditor.
8.2 CONSEQUENCES OF DEFAULT & ACCELERATION: Upon the occurrence of any Event of Default, the entire outstanding loan balance, together with accrued interest and costs, shall forthwith become immediately due and payable upon 7 days written notice, and the Lender shall be entitled to enforce the SARFAESI Act, repossess the hypothecated machinery, and appoint a receiver.
8.3 PENAL CHARGES: Overdue installments shall attract penal interest at the rate of 2.0% per month (24% per annum) calculated from the due date until actual realization.

SECTION 9: JURISDICTION & GOVERNING LAW
9.1 This agreement shall be governed by and construed in accordance with the substantive laws of the Republic of India.
9.2 Any legal proceedings, recovery suits, or claims arising out of this contract shall be submitted to the exclusive jurisdiction of the competent civil courts in Bengaluru, Karnataka.

IN WITNESS WHEREOF, the parties hereto have executed this Agreement on the day and year first written above.
For Apex Dynamics Precision Engg Pvt Ltd (Borrower) - Rajesh S. Menon (Managing Director)
For Ujjivan Small Finance Bank Limited (Lender) - Authorized Officer`
};
