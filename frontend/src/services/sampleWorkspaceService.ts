import { clientService, expenseService, invoiceService } from './invoiceService';
import { contractService } from './contractService';
import { SAMPLE_CLIENTS, SAMPLE_CONTRACTS, SAMPLE_EXPENSES, SAMPLE_INVOICES } from '../data/sampleWorkspace';

const isoDaysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export interface LoadProgress {
  step: 'clients' | 'invoices' | 'expenses' | 'contracts' | 'done';
  detail: string;
}

/**
 * Creates the opt-in sample workspace through the normal APIs, so every record is an ordinary, editable, deletable
 * record of the signed-in user. Contract analysis is best-effort: if the AI service is down the rest still loads.
 */
export async function loadSampleWorkspace(onProgress?: (p: LoadProgress) => void): Promise<{ contractsLoaded: number; contractsFailed: number }> {
  onProgress?.({ step: 'clients', detail: 'Creating clients' });
  const clients = [];
  for (const c of SAMPLE_CLIENTS) clients.push(await clientService.create({ ...c }));

  onProgress?.({ step: 'invoices', detail: 'Creating itemised invoices' });
  for (const inv of SAMPLE_INVOICES) {
    await invoiceService.create({
      client_id: clients[inv.client].id,
      issue_date: isoDaysFromNow(-inv.daysAgo),
      due_date: isoDaysFromNow(inv.dueInDays),
      gst_rate: 18,
      status: inv.status,
      notes: 'Sample workspace record',
      items: inv.items,
    });
  }

  onProgress?.({ step: 'expenses', detail: 'Creating expenses' });
  for (const e of SAMPLE_EXPENSES) {
    await expenseService.create({ category: e.category, description: e.description, amount: e.amount, expense_date: isoDaysFromNow(-e.daysAgo) });
  }

  let contractsLoaded = 0;
  let contractsFailed = 0;
  for (const c of SAMPLE_CONTRACTS) {
    onProgress?.({ step: 'contracts', detail: `Analysing ${c.filename}` });
    try {
      await contractService.analyzeTextAsContract(c.text, c.filename);
      contractsLoaded++;
    } catch {
      contractsFailed++;
    }
  }
  onProgress?.({ step: 'done', detail: 'Done' });
  return { contractsLoaded, contractsFailed };
}
