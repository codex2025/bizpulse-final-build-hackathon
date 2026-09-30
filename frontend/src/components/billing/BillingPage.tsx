import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, CheckCircle, Clock, FileX, Trash2, Edit, X, Receipt, Printer, Download
} from 'lucide-react';
import { Topbar } from '../common/Topbar';
import { invoiceService, clientService } from '../../services/invoiceService';
import { CustomDropdown } from '../common/CustomDropdown';
import { useToast } from '../../context/ToastContext';
import { BillReceiptModal } from './BillReceiptModal';
import { AnimatedNumber } from '../common/AnimatedNumber';

interface ClientItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  gst_number?: string;
}

interface InvoiceItemLine {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  client?: ClientItem;
  issue_date: string;
  due_date: string;
  total_amount: number;
  subtotal?: number;
  gst_rate?: number;
  gst_amount?: number;
  status: 'paid' | 'pending' | 'overdue' | 'draft';
  items?: InvoiceItemLine[];
  notes?: string;
}

const statusConfig: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; class: string }> = {
  paid: { icon: CheckCircle, class: 'text-teal-700 bg-teal-50 border border-teal-200' },
  pending: { icon: Clock, class: 'text-amber-700 bg-amber-50 border border-amber-200' },
  overdue: { icon: FileX, class: 'text-vermilion-700 bg-vermilion-50 border border-vermilion-200' },
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
    mutationFn: (data: typeof form) => clientService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client Created', `${form.name} added to your client list.`);
      onClose();
    },
    onError: () => toast.error('Failed to create client')
  });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6 shadow-2xl bg-white border border-slate-200 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-extrabold text-ink-900">New Client Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Client / Company Name</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Apex Dynamics Ltd" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Billing Email</label>
            <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="accounts@apexdynamics.com" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Phone</label>
            <input className="input-field font-mono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Registered Address</label>
            <input className="input-field" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City, State" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">GSTIN (Optional)</label>
            <input className="input-field font-mono uppercase" value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="29AAACG1234F1Z5" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-xs cursor-pointer py-2.5 rounded-xl font-bold">Cancel</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary flex-1 text-xs cursor-pointer py-2.5 rounded-xl font-bold">
            {mutation.isPending ? 'Saving...' : 'Register Client'}
          </button>
        </div>
      </div>
    </div>
  );
};

const InvoiceModal = ({ onClose, clients }: { onClose: () => void; clients: ClientItem[] }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const [gstRateInput, setGstRateInput] = useState<string>('18');
  const [form, setForm] = useState(() => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 15);
    return {
      client_id: clients[0]?.id || '',
      issue_date: today.toISOString().split('T')[0],
      due_date: future.toISOString().split('T')[0],
      gst_rate: 18,
      notes: '',
      items: [{ description: 'Commercial Software Consulting & Deliverables', quantity: 1, unit_price: 25000 }],
    };
  });

  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.name,
    description: c.email
  }));

  const parsedGstRate = gstRateInput === '' ? 18 : Number(gstRateInput) || 0;

  const mutation = useMutation({
    mutationFn: (data: typeof form) => invoiceService.create({ ...data, gst_rate: parsedGstRate }),
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
  const updateItem = (i: number, k: keyof InvoiceItemLine, v: string | number) =>
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [k]: v };
      return { ...f, items };
    });

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const gst = (subtotal * parsedGstRate) / 100;
  const total = subtotal + gst;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl bg-white border border-slate-200 rounded-3xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cobalt-50 text-cobalt-600 border border-cobalt-100 flex items-center justify-center">
              <Receipt size={16} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-ink-900">
                Generate Commercial Tax Invoice
              </h2>
              <p className="text-xs text-slate-500 font-medium">Issue formal GST invoice with itemized line items</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Client / Counterparty</label>
              <CustomDropdown
                options={clientOptions.length > 0 ? clientOptions : [{ value: '', label: 'No clients available' }]}
                value={form.client_id}
                onChange={val => setForm(f => ({ ...f, client_id: val }))}
                className="w-full"
                buttonClassName="w-full py-2.5"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                GST Rate (%)
              </label>
              <div className="space-y-2">
                <div className="flex gap-1.5 flex-wrap">
                  {[0, 5, 12, 18, 28].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setGstRateInput(String(rate))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        parsedGstRate === rate
                          ? 'bg-cobalt-600 text-white border-cobalt-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-cobalt-300 hover:bg-cobalt-50'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Custom"
                    value={gstRateInput}
                    onChange={(e) => setGstRateInput(e.target.value)}
                    className="input-field pr-8 text-xs font-semibold font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Issue Date</label>
              <input type="date" className="input-field font-mono" value={form.issue_date}
                onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Payment Due Date</label>
              <input type="date" className="input-field font-mono" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600">Deliverables & Services</label>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-xs font-extrabold text-cobalt-600 hover:text-cobalt-700 px-2.5 py-1.5 rounded-lg border border-cobalt-200 bg-cobalt-50 hover:bg-cobalt-100 transition-all cursor-pointer">
                <Plus size={13} /> Add Line Item
              </button>
            </div>
            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-2 px-1">
              <span className="col-span-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</span>
              <span className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qty</span>
              <span className="col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit Rate</span>
              <span className="col-span-1"></span>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="grid grid-cols-12 gap-2">
                  <input className="input-field col-span-6 text-xs font-semibold" placeholder="Work / Service description"
                    value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                  <input type="number" className="input-field col-span-2 text-xs font-semibold font-mono" placeholder="Qty"
                    value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                  <input type="number" className="input-field col-span-3 text-xs font-semibold font-mono" placeholder="Rate (₹)"
                    value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} />
                  <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                    className="text-slate-300 hover:text-vermilion-600 col-span-1 flex items-center justify-center cursor-pointer p-1 rounded hover:bg-vermilion-50">
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* Row subtotal */}
                {(item.quantity > 0 && item.unit_price > 0) && (
                  <p className="text-[10.5px] text-slate-500 font-mono pl-1">
                    Subtotal: <span className="font-bold text-slate-700">₹{(item.quantity * item.unit_price).toLocaleString('en-IN')}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Financial Calculation Box */}
          <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-1.5 border border-slate-200">
            <div className="flex justify-between text-slate-500 font-medium font-mono tabular-nums">
              <span>Subtotal (Net of GST)</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500 font-medium font-mono tabular-nums">
              <span>GST ({parsedGstRate}%)</span><span>{fmt(gst)}</span>
            </div>
            <div className="flex justify-between text-ink-900 font-black text-sm border-t border-slate-200 pt-2 mt-1 font-mono tabular-nums">
              <span>Total Invoice Amount</span><span className="text-cobalt-600">{fmt(total)}</span>
            </div>
          </div>

          <textarea placeholder="Payment remittance terms, bank account details, UPI VPA, or notes..." className="input-field min-h-[60px]" rows={2}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs cursor-pointer py-2.5 rounded-xl font-bold">Cancel</button>
          <button
            type="button"
            onClick={() => {
              if (!form.client_id) {
                toast.error('Select a Client', 'Please select a client before generating the invoice.');
                return;
              }
              mutation.mutate(form);
            }}
            disabled={mutation.isPending}
            className="btn-primary flex-1 text-xs cursor-pointer py-2.5 rounded-xl font-bold"
          >
            {mutation.isPending ? 'Generating Bill...' : 'Create & Issue Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BillingPage: React.FC = () => {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedInvoiceForBill, setSelectedInvoiceForBill] = useState<InvoiceRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const qc = useQueryClient();
  const toast = useToast();

  const { data: rawInvoices = [] } = useQuery<InvoiceRecord[]>({
    queryKey: ['invoices'],
    queryFn: invoiceService.getAll
  });
  const { data: rawClients = [] } = useQuery<ClientItem[]>({
    queryKey: ['clients'],
    queryFn: clientService.getAll
  });

  const invoices: InvoiceRecord[] = Array.isArray(rawInvoices) ? rawInvoices : [];
  const clients: ClientItem[] = Array.isArray(rawClients) ? rawClients : [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => invoiceService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.info('Invoice Deleted', 'Invoice has been permanently removed.');
      setConfirmDeleteId(null);
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

  const statusOptions = [
    { value: 'all', label: 'All Invoices' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'draft', label: 'Draft' },
  ];

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      cleanInvoiceNumber(inv.invoice_number)?.toLowerCase().includes(search.toLowerCase()) ||
      inv.client?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalInvoiced = invoices.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

  const exportInvoicesToCSV = () => {
    if (invoices.length === 0) {
      toast.info('No Data', 'No invoices available to export.');
      return;
    }
    const headers = ['Invoice Number', 'Client', 'Issue Date', 'Due Date', 'GST Rate', 'Total Amount', 'Status'];
    const rows = invoices.map(i => [
      `"${cleanInvoiceNumber(i.invoice_number)}"`,
      `"${(i.client?.name || '').replace(/"/g, '""')}"`,
      `"${i.issue_date}"`,
      `"${i.due_date}"`,
      `${i.gst_rate ?? 18}%`,
      i.total_amount,
      `"${i.status}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bizpulse_invoices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export Successful', 'Invoices exported to CSV');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar title="Commercial Billing & Accounts Receivable" subtitle="Generate, monitor, and collect enterprise tax invoices and receipts" />
      
      {/* 4-Stat Overview Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Invoiced</span>
          <span className="text-2xl font-black text-ink-900 font-mono tabular-nums block">
            <AnimatedNumber value={totalInvoiced} prefix="₹" />
          </span>
          <span className="text-xs text-slate-400 font-medium">Across {invoices.length} billings</span>
        </div>

        <div className="card p-5 border border-teal-100 bg-teal-50/30 rounded-3xl shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 block">Collected / Paid</span>
          <span className="text-2xl font-black text-teal-700 font-mono tabular-nums block">
            <AnimatedNumber value={totalPaid} prefix="₹" />
          </span>
          <span className="text-xs text-teal-600 font-medium">Settled into bank account</span>
        </div>

        <div className="card p-5 border border-amber-100 bg-amber-50/30 rounded-3xl shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">Pending Outstanding</span>
          <span className="text-2xl font-black text-amber-700 font-mono tabular-nums block">
            <AnimatedNumber value={totalPending} prefix="₹" />
          </span>
          <span className="text-xs text-amber-600 font-medium">Awaiting client payment</span>
        </div>

        <div className="card p-5 border border-slate-200 rounded-3xl bg-white shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Overdue Alert</span>
          <span className="text-2xl font-black text-vermilion-600 font-mono tabular-nums block">
            <AnimatedNumber value={totalOverdue} prefix="₹" />
          </span>
          <span className="text-xs text-slate-400 font-medium">Past designated due date</span>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search bills by invoice # or client name..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-xs font-semibold w-full"
            />
          </div>
          <CustomDropdown
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-full sm:w-44"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportInvoicesToCSV}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
            title="Export CSV"
          >
            <Download size={14} /> Export
          </button>
          <button
            type="button"
            onClick={() => setShowClientModal(true)}
            className="flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/70 transition-all cursor-pointer"
          >
            <Plus size={14} /> New Client
          </button>
          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            className="btn-primary flex items-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
          >
            <Plus size={14} /> Generate Work Bill
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card overflow-hidden p-0 border border-slate-200 rounded-3xl bg-white shadow-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {['Invoice #', 'Client / Counterparty', 'Issue Date', 'Due Date', 'GST Rate', 'Total Amount', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left text-[11px] text-slate-500 font-extrabold uppercase tracking-wider px-4 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14 text-slate-400 text-xs font-medium">
                  No invoices generated yet. Click "Generate Work Bill" to issue your first commercial tax invoice.
                </td>
              </tr>
            ) : filtered.map((inv) => {
              const st = statusConfig[inv.status] || statusConfig.draft;
              const Icon = st.icon;
              const invoiceNo = cleanInvoiceNumber(inv.invoice_number);
              return (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="px-4 py-3.5 text-xs font-mono font-black text-cobalt-600">{invoiceNo}</td>
                  <td className="px-4 py-3.5 text-xs text-ink-900 font-bold">{inv.client?.name || '—'}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-mono text-[11px]">{inv.issue_date}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-mono text-[11px]">{inv.due_date}</td>
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-600 font-mono">{inv.gst_rate ?? 18}%</td>
                  <td className="px-4 py-3.5 text-xs font-black text-ink-900 font-mono tabular-nums">
                    ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full capitalize ${st.class}`}>
                      <Icon size={11} /> {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceForBill(inv)}
                        title="View / Print Tax Bill"
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Printer size={13} className="text-cobalt-600" />
                        <span>Print Bill</span>
                      </button>

                      {inv.status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => markPaid.mutate(inv.id)}
                          className="text-[11px] text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition-all font-extrabold cursor-pointer"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(inv.id)}
                        className="text-slate-300 hover:text-vermilion-600 transition-colors p-1 cursor-pointer opacity-0 group-hover:opacity-100 rounded-lg hover:bg-vermilion-50"
                        title="Delete Invoice"
                      >
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

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-vermilion-50 border border-vermilion-200 flex items-center justify-center text-vermilion-600">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-ink-900">Delete Invoice?</h3>
                <p className="text-xs text-slate-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">The invoice and all associated line items will be permanently removed from your ledger.</p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Keep Invoice
              </button>
              <button
                type="button"
                onClick={() => deleteMut.mutate(confirmDeleteId)}
                disabled={deleteMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-vermilion-600 hover:bg-vermilion-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
              >
                {deleteMut.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
