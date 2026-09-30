import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Printer, X, FileText, Check, Edit3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/userService';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal?: number;
  gst_rate?: number;
  gst_amount?: number;
  total_amount: number;
  status: string;
  notes?: string;
  client?: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    gst_number?: string;
  };
  items?: InvoiceItem[];
}

interface Props {
  invoice: InvoiceData | null;
  onClose: () => void;
}

const cleanInvoiceNumber = (num: string) => {
  if (!num) return 'INV-0001';
  return num.replace(/^(INV-)+/i, 'INV-');
};

export const BillReceiptModal: React.FC<Props> = ({ invoice, onClose }) => {
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: userService.getProfile });
  const printRef = useRef<HTMLDivElement>(null);

  // Editable fields directly in bill
  const [editableGstNumber, setEditableGstNumber] = useState<string>(() => profile?.gst_number || '27AAACG1234F1Z5');
  const [editableGstRate, setEditableGstRate] = useState<number | string>(() => invoice?.gst_rate ?? 18);
  const [isEditingGst, setIsEditingGst] = useState(false);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const isPaid = invoice.status === 'paid';
  const effectiveGstRate = Number(editableGstRate) || 0;

  const calculatedSubtotal = invoice.subtotal
    ? Number(invoice.subtotal)
    : (invoice.items && invoice.items.length > 0)
    ? invoice.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
    : Math.round(Number(invoice.total_amount || 0) / (1 + (invoice.gst_rate || 18) / 100));

  const calculatedGst = Math.round((calculatedSubtotal * effectiveGstRate) / 100);
  const calculatedTotal = calculatedSubtotal + calculatedGst;

  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [
    { description: 'Professional Services & Consulting', quantity: 1, unit_price: calculatedSubtotal, total: calculatedSubtotal }
  ];

  const invoiceNo = cleanInvoiceNumber(invoice.invoice_number);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cobalt-50 text-cobalt-600 border border-cobalt-100 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-ink-900">
                Tax Invoice & Service Bill — {invoiceNo}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Official GST Compliant Commercial Document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-cobalt-600 hover:bg-cobalt-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Printer size={14} />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div ref={printRef} className="p-8 space-y-6 text-slate-900 bg-white print:p-0">
          {/* Top Brand & Metadata */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-cobalt-600 text-white flex items-center justify-center font-black text-sm">
                  BP
                </div>
                <h1 className="text-xl font-black text-ink-900 tracking-tight">
                  {profile?.business_name || profile?.full_name || 'BIZPULSE COMMERCIAL LABS'}
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium">Enterprise Financial Operating Architecture</p>
              
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold text-slate-500 font-mono">GSTIN:</span>
                {isEditingGst ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editableGstNumber}
                      onChange={(e) => setEditableGstNumber(e.target.value.toUpperCase())}
                      className="border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold uppercase w-36"
                    />
                    <button
                      onClick={() => setIsEditingGst(false)}
                      className="p-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-xs font-mono font-extrabold text-ink-900">{editableGstNumber}</span>
                    <button
                      onClick={() => setIsEditingGst(true)}
                      className="text-slate-400 hover:text-slate-700 p-0.5 print:hidden cursor-pointer"
                      title="Edit GST Number"
                    >
                      <Edit3 size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className={`inline-block text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                isPaid
                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isPaid ? 'PAID & SETTLED' : 'PENDING REMITTANCE'}
              </span>
              <p className="text-xs font-black text-ink-900 font-mono mt-1">{invoiceNo}</p>
              <p className="text-[11px] text-slate-500 font-medium font-mono">Issued: {invoice.issue_date}</p>
              <p className="text-[11px] text-slate-500 font-medium font-mono">Due: {invoice.due_date}</p>
            </div>
          </div>

          {/* Billed To / From Addresses */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Billed To (Client)</p>
              <h4 className="font-extrabold text-sm text-ink-900">{invoice.client?.name || 'Counterparty Customer'}</h4>
              <p className="text-xs text-slate-600 font-medium mt-0.5">{invoice.client?.email || 'accounts@client.com'}</p>
              {invoice.client?.address && <p className="text-xs text-slate-500 mt-0.5">{invoice.client.address}</p>}
              {invoice.client?.gst_number && (
                <p className="text-xs font-mono text-slate-600 mt-1">Client GSTIN: <strong>{invoice.client.gst_number}</strong></p>
              )}
            </div>

            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Service Origin</p>
              <h4 className="font-extrabold text-sm text-ink-900">{profile?.full_name || 'Account Holder'}</h4>
              <p className="text-xs text-slate-600 font-medium mt-0.5">{profile?.email || 'finance@bizpulse.local'}</p>
              <p className="text-xs text-slate-500 mt-0.5">Verified Indian Merchant Provider</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-hidden border border-slate-200 rounded-2xl">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Item & Scope Description</th>
                  <th className="py-2.5 px-4 text-center">Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Rate</th>
                  <th className="py-2.5 px-4 text-right">Net Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.map((it, idx) => {
                  const lineTotal = (Number(it.quantity) || 1) * Number(it.unit_price);
                  return (
                    <tr key={idx}>
                      <td className="py-3 px-4 font-bold text-ink-900">{it.description}</td>
                      <td className="py-3 px-4 text-center font-mono">{it.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{Number(it.unit_price).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">₹{lineTotal.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Calculations Summary */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-medium font-mono tabular-nums">
                <span>Taxable Value (Subtotal):</span>
                <span>₹{calculatedSubtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium font-mono tabular-nums items-center">
                <span className="flex items-center gap-1">
                  GST ({effectiveGstRate}%):
                  <input
                    type="number"
                    value={editableGstRate}
                    onChange={(e) => setEditableGstRate(e.target.value)}
                    className="w-12 text-center border border-slate-200 rounded text-[11px] font-mono py-0.5 print:hidden"
                  />
                </span>
                <span>₹{calculatedGst.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-base font-black text-ink-900 border-t-2 border-slate-900 pt-2 font-mono tabular-nums">
                <span>Total Amount Due:</span>
                <span className="text-cobalt-600">₹{calculatedTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Remittance & Bank Notes */}
          <div className="border-t border-slate-200 pt-4 text-xs text-slate-500 space-y-1">
            <p className="font-bold text-slate-700">Remittance Directives & Payment Terms:</p>
            <p className="font-medium">{invoice.notes || 'Please settle via direct NEFT/RTGS to the authorized bank account or UPI within the specified due date.'}</p>
            <p className="text-[10px] text-slate-400 font-medium pt-2">
              This document is a computer-generated tax invoice issued in accordance with applicable electronic billing guidelines.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
