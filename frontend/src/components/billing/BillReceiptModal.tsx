import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Printer, X, FileText, Building2, Check, Edit3 } from 'lucide-react';
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
  const [editableGstNumber, setEditableGstNumber] = useState<string>('');
  const [editableGstRate, setEditableGstRate] = useState<number | string>(18);
  const [isEditingGst, setIsEditingGst] = useState(false);

  // Initialize defaults on open
  React.useEffect(() => {
    if (invoice) {
      setEditableGstNumber(profile?.gst_number || '27AAACG1234F1Z5');
      setEditableGstRate(invoice.gst_rate ?? 18);
    }
  }, [invoice, profile]);

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
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Tax Invoice & Service Bill — {invoiceNo}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Official GST Compliant Document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
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

        {/* Printable Tax Invoice Sheet */}
        <div ref={printRef} className="p-8 sm:p-10 space-y-7 bg-white text-slate-900 font-sans print:p-0">
          {/* Top Section: Business Brand & Invoice Status */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    {profile?.business_name || profile?.full_name || 'Bizpulse Verified Enterprise'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">{profile?.email || 'billing@bizpulse.com'}</p>
                </div>
              </div>

              {/* Editable GST Number Field */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-bold text-slate-500">GSTIN:</span>
                {isEditingGst ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editableGstNumber}
                      onChange={(e) => setEditableGstNumber(e.target.value)}
                      placeholder="e.g. 27AAACG1234F1Z5"
                      className="input-field py-1 px-2 text-xs font-mono w-44"
                    />
                    <button
                      onClick={() => setIsEditingGst(false)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                      {editableGstNumber || '27AAACG1234F1Z5'}
                    </span>
                    <button
                      onClick={() => setIsEditingGst(true)}
                      className="text-slate-400 hover:text-brand-600 print:hidden p-0.5 cursor-pointer"
                      title="Edit GST Number"
                    >
                      <Edit3 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <div>
                <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                  isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isPaid ? '✓ PAID IN FULL' : '⏳ PAYMENT DUE'}
                </span>
              </div>
              <p className="text-base font-black text-slate-900 font-mono mt-1.5">{invoiceNo}</p>
              <p className="text-xs text-slate-500 font-medium">Issue Date: <strong className="text-slate-700">{invoice.issue_date}</strong></p>
              <p className="text-xs text-slate-500 font-medium">Due Date: <strong className="text-slate-700">{invoice.due_date}</strong></p>
            </div>
          </div>

          {/* Billed To Client Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Billed To (Client / Customer)</span>
              <h4 className="text-sm font-extrabold text-slate-900">{invoice.client?.name || 'Valued Client'}</h4>
              <p className="text-xs text-slate-600 font-medium">{invoice.client?.email || 'N/A'}</p>
              {invoice.client?.address && (
                <p className="text-xs text-slate-500 font-medium">{invoice.client.address}</p>
              )}
            </div>

            {invoice.client?.gst_number && (
              <div className="sm:text-right space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Client GSTIN</span>
                <p className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                  {invoice.client.gst_number}
                </p>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Description of Work / Service</th>
                  <th className="px-4 py-3 text-center w-16">Qty</th>
                  <th className="px-4 py-3 text-right w-28">Unit Rate</th>
                  <th className="px-4 py-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-bold text-slate-800">{item.description}</td>
                    <td className="px-4 py-3.5 text-center text-slate-600 font-medium">{item.quantity}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-700">₹{Number(item.unit_price).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900">
                      ₹{Number(item.quantity * item.unit_price).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculation & Tax Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
            <div className="space-y-1.5 max-w-xs text-xs text-slate-500 font-medium">
              <p className="font-bold text-slate-800">Terms & Conditions:</p>
              <p className="leading-relaxed">
                {invoice.notes || 'Payment is requested within the due date specified. Thank you for your business!'}
              </p>
            </div>

            <div className="w-full sm:w-72 space-y-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <span>Subtotal</span>
                <span className="font-mono font-bold text-slate-900">₹{calculatedSubtotal.toLocaleString('en-IN')}</span>
              </div>

              {/* Editable GST percentage */}
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <span>GST Rate:</span>
                  <input
                    type="number"
                    value={editableGstRate}
                    onChange={(e) => setEditableGstRate(e.target.value)}
                    placeholder="18"
                    className="w-12 py-0.5 px-1 text-center font-bold text-xs rounded border border-slate-300 bg-white"
                  />
                  <span>%</span>
                </span>
                <span className="font-mono font-bold text-slate-900">₹{calculatedGst.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2 mt-1">
                <span>Grand Total</span>
                <span className="font-mono text-brand-600 text-base">₹{calculatedTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Clean Stamp Footer */}
          <div className="border-t border-slate-200 pt-5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Powered by Bizpulse Invoicing Engine</span>
            <span>Computer Generated Tax Invoice • No Signature Required</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
