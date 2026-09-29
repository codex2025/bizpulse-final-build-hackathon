import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, CheckCircle, Clock, FileX, Trash2, Edit, X, Receipt, Printer
} from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { invoiceService, clientService } from '../../services/invoiceService';
import { CustomDropdown } from '../common/CustomDropdown';
import { useToast } from '../../context/ToastContext';
import { BillReceiptModal } from './BillReceiptModal';

const statusConfig: Record<string, { icon: any; class: string }> = {
  paid: { icon: CheckCircle, class: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
  pending: { icon: Clock, class: 'text-amber-700 bg-amber-50 border border-amber-200' },
  overdue: { icon: FileX, class: 'text-red-700 bg-red-50 border border-red-200' },
  draft: { icon: Edit, class: 'text-slate-600 bg-slate-50 border border-slate-200' },
};

const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

const cleanInvoiceNumber = (num: string) => {
  if (!num) return 'INV-0001';
  return num.replace(/^(INV-)+/i, 'INV-');
};

const ClientModal = ({ onClose }: { onClose: () => void }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', gst_number: '' });

  const mutation = useMutation({
    mutationFn: (data: any) => clientService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client Created', `${form.name} added to your client list.`);
      onClose();
    },
    onError: () => toast.error('Failed to create client')
  });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6 shadow-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-extrabold text-slate-900">New Client Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs font-bold text-slate-600 mb-1 block">Client / Company Name</label><input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Acme Corp" /></div>
          <div><label className="text-xs font-bold text-slate-600 mb-1 block">Billing Email</label><input className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="billing@acme.com" /></div>
          <div><label className="text-xs font-bold text-slate-600 mb-1 block">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" /></div>
          <div><label className="text-xs font-bold text-slate-600 mb-1 block">Address</label><input className="input-field" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City, State" /></div>
          <div><label className="text-xs font-bold text-slate-600 mb-1 block">GST Number (Optional)</label><input className="input-field" value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="27AAACG1234F1Z5" /></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-xs cursor-pointer">Cancel</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary flex-1 text-xs cursor-pointer">
            {mutation.isPending ? 'Saving...' : 'Save Client'}
          </button>
        </div>
      </div>
    </div>
  );
};

const InvoiceModal = ({ onClose, clients }: { onClose: () => void; clients: any[] }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const [gstRateInput, setGstRateInput] = useState<string>('18');
  const [form, setForm] = useState({
    client_id: clients[0]?.id || '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    gst_rate: 18,
    notes: '',
    items: [{ description: 'Software Consulting & Deliverable', quantity: 1, unit_price: 25000 }],
  });

  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.name,
    description: c.email
  }));

  const parsedGstRate = gstRateInput === '' ? 18 : Number(gstRateInput) || 0;

  const mutation = useMutation({
    mutationFn: (data: any) => invoiceService.create({ ...data, gst_rate: parsedGstRate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['visualizations'] });
      toast.success('Bill Generated', 'Tax invoice & receipt created successfully.');
      onClose();
    },
    onError: () => toast.error('Failed to generate bill')
  });

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: 0 }] }));
  const updateItem = (i: number, k: string, v: any) =>
    setForm(f => { const items = [...f.items]; items[i] = { ...items[i], [k]: v }; return { ...f, items }; });

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const gst = (subtotal * parsedGstRate) / 100;
  const total = subtotal + gst;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl bg-white border border-slate-200 space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-brand-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              Generate Work Bill & Tax Invoice
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Client / Customer</label>
              <CustomDropdown
                options={clientOptions.length > 0 ? clientOptions : [{ value: '', label: 'No clients available' }]}
                value={form.client_id}
                onChange={val => setForm(f => ({ ...f, client_id: val }))}
                className="w-full"
                buttonClassName="w-full py-2.5"
              />
            </div>

            {/* Editable GST Percentage with placeholder 18 */}
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                GST Percentage (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="18"
                  value={gstRateInput}
                  onChange={(e) => setGstRateInput(e.target.value)}
                  className="input-field pr-8 text-xs font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                  %
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                Editable tax slab (Default: 18% standard rate)
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Issue Date</label>
              <input type="date" className="input-field" value={form.issue_date}
                onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Due Date</label>
              <input type="date" className="input-field" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          {/* Work / Deliverable Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-600">Work / Deliverable Items</label>
              <button type="button" onClick={addItem} className="text-xs font-extrabold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer">
                <Plus size={12} /> Add Line Item
              </button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <input className="input-field col-span-6 text-xs font-semibold" placeholder="Work / Service description"
                  value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                <input type="number" className="input-field col-span-2 text-xs font-semibold" placeholder="Qty"
                  value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                <input type="number" className="input-field col-span-3 text-xs font-semibold" placeholder="Unit Rate (₹)"
                  value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} />
                <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                  className="text-slate-400 hover:text-red-600 col-span-1 flex items-center justify-center cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Real-time Calculation Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-1.5 border border-slate-200">
            <div className="flex justify-between text-slate-500 font-medium"><span>Subtotal (Works)</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-slate-500 font-medium"><span>GST ({parsedGstRate}%)</span><span>{fmt(gst)}</span></div>
            <div className="flex justify-between text-slate-900 font-black text-sm border-t border-slate-200 pt-2 mt-1">
              <span>Grand Total Payable</span><span>{fmt(total)}</span>
            </div>
          </div>

          <textarea placeholder="Payment notes, bank details, or UPI ID (optional)" className="input-field min-h-[60px]" rows={2}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs cursor-pointer">Cancel</button>
          <button type="button" onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary flex-1 text-xs cursor-pointer">
            {mutation.isPending ? 'Generating Bill...' : 'Create & Generate Bill'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BillingPage: React.FC = () => {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedInvoiceForBill, setSelectedInvoiceForBill] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const toast = useToast();

  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoiceService.getAll });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: clientService.getAll });

  const deleteMut = useMutation({
    mutationFn: (id: string) => invoiceService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.info('Invoice Deleted');
    }
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => invoiceService.update(id, { status: 'paid' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['visualizations'] });
      toast.success('Payment Received', 'Invoice marked as paid.');
    }
  });

  const filtered = invoices.filter((inv: any) =>
    cleanInvoiceNumber(inv.invoice_number)?.toLowerCase().includes(search.toLowerCase()) ||
    inv.client?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar title="Work Billing & Invoicing" subtitle="Generate, print, and track commercial tax invoices and service bills" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search bills by invoice # or client..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 text-xs font-semibold w-full"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowClientModal(true)} className="btn-secondary flex items-center gap-2 text-xs cursor-pointer">
            <Plus size={14} /> New Client
          </button>
          <button onClick={() => setShowInvoiceModal(true)} className="btn-primary flex items-center gap-2 text-xs cursor-pointer">
            <Plus size={14} /> Generate Work Bill
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0 border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {['Invoice / Bill #', 'Client / Customer', 'Issue Date', 'Due Date', 'GST Rate', 'Total Amount', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left text-[11px] text-slate-500 font-extrabold uppercase tracking-wider px-4 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-xs font-semibold">No bills generated yet. Click "Generate Work Bill" to create your first store/work invoice.</td></tr>
            ) : filtered.map((inv: any) => {
              const st = statusConfig[inv.status] || statusConfig.draft;
              const Icon = st.icon;
              const invoiceNo = cleanInvoiceNumber(inv.invoice_number);
              return (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-4 py-3.5 text-xs font-mono font-extrabold text-brand-600">{invoiceNo}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-800 font-bold">{inv.client?.name || '—'}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">{inv.issue_date}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">{inv.due_date}</td>
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-700">{inv.gst_rate ?? 18}%</td>
                  <td className="px-4 py-3.5 text-xs font-extrabold text-slate-900">₹{Number(inv.total_amount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full capitalize ${st.class}`}>
                      <Icon size={11} /> {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInvoiceForBill(inv)}
                        title="View / Print Tax Bill"
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Printer size={13} className="text-brand-600" />
                        <span>Print Bill</span>
                      </button>

                      {inv.status !== 'paid' && (
                        <button onClick={() => markPaid.mutate(inv.id)}
                          className="text-[11px] text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-all font-extrabold cursor-pointer">
                          Mark Paid
                        </button>
                      )}
                      <button onClick={() => deleteMut.mutate(inv.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showInvoiceModal && <InvoiceModal onClose={() => setShowInvoiceModal(false)} clients={clients} />}
      {showClientModal && <ClientModal onClose={() => setShowClientModal(false)} />}
      {selectedInvoiceForBill && (
        <BillReceiptModal
          invoice={selectedInvoiceForBill}
          onClose={() => setSelectedInvoiceForBill(null)}
        />
      )}
    </div>
  );
};
