import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Printer, X, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { amountInWords } from '../../utils/amountInWords';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
  hsn_sac?: string;
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

interface SellerDetails {
  gstin: string;
  pan: string;
  address: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  signatory: string;
}

const STORAGE_KEY = 'bizpulse_invoice_seller';
const DEFAULT_SAC = '998314'; // IT design & development services; editable per invoice

const cleanInvoiceNumber = (num: string) => {
  if (!num) return 'INV-0001';
  return num.replace(/^(INV-)+/i, 'INV-');
};

const inr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const loadSeller = (): Partial<SellerDetails> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

// First two digits of a GSTIN are the state code.
const stateCode = (gstin?: string) => (gstin && /^\d{2}/.test(gstin.trim()) ? gstin.trim().slice(0, 2) : '');

/** A field that is an input on screen and plain text on paper. */
const EditableField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  mono?: boolean;
  upper?: boolean;
  wide?: boolean;
}> = ({ label, value, placeholder, onChange, mono, upper, wide }) => (
  <label className={`flex items-baseline gap-2 text-[11px] ${wide ? 'w-full' : ''}`}>
    <span className="font-bold text-slate-500 uppercase tracking-wider shrink-0">{label}:</span>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
      className={`min-w-0 flex-1 bg-transparent border-b border-dashed border-slate-300 focus:border-cobalt-500 focus:outline-none py-0.5 font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-300 ${mono ? 'font-mono' : ''}`}
    />
  </label>
);

export const BillReceiptModal: React.FC<Props> = ({ invoice, onClose }) => {
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: userService.getProfile });

  const [seller, setSeller] = useState<SellerDetails>(() => {
    const saved = loadSeller();
    return {
      gstin: saved.gstin || '',
      pan: saved.pan || '',
      address: saved.address || '',
      bankName: saved.bankName || '',
      accountNumber: saved.accountNumber || '',
      ifsc: saved.ifsc || '',
      upiId: saved.upiId || '',
      signatory: saved.signatory || '',
    };
  });
  const [gstRate, setGstRate] = useState<number | string>(() => invoice?.gst_rate ?? 18);
  const [sac, setSac] = useState(DEFAULT_SAC);

  if (!invoice) return null;

  const patchSeller = (patch: Partial<SellerDetails>) => {
    setSeller((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: the values still apply to this invoice
      }
      return next;
    });
  };

  const sellerGstin = seller.gstin || profile?.gst_number || '';
  const isPaid = invoice.status === 'paid';
  const rate = Math.max(0, Number(gstRate) || 0);

  const items =
    invoice.items && invoice.items.length > 0
      ? invoice.items
      : [
          {
            description: 'Professional Services & Consulting',
            quantity: 1,
            unit_price: invoice.subtotal
              ? Number(invoice.subtotal)
              : Math.round(Number(invoice.total_amount || 0) / (1 + (invoice.gst_rate ?? 18) / 100)),
          },
        ];

  const lines = items.map((it) => {
    const qty = Number(it.quantity) || 1;
    const unit = Number(it.unit_price) || 0;
    return { ...it, qty, unit, taxable: qty * unit };
  });
  const taxable = lines.reduce((s, l) => s + l.taxable, 0);
  const totalTax = Math.round(taxable * rate) / 100;
  const grandTotal = taxable + totalTax;

  // Inter-state supply (different GSTIN state codes) is taxed as IGST; otherwise CGST + SGST.
  const sellerState = stateCode(sellerGstin);
  const clientState = stateCode(invoice.client?.gst_number);
  const isInterState = Boolean(sellerState && clientState && sellerState !== clientState);

  const invoiceNo = cleanInvoiceNumber(invoice.invoice_number);
  const sellerName = profile?.business_name || profile?.full_name || 'Your Business Name';
  const upiUri = seller.upiId
    ? `upi://pay?pa=${encodeURIComponent(seller.upiId)}&pn=${encodeURIComponent(sellerName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`
    : '';

  const modal = (
    <div className="bill-receipt-modal fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="invoice-print-container bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6"
        role="dialog"
        aria-label={`Tax invoice ${invoiceNo}`}
      >
        {/* Header bar (screen only) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cobalt-50 text-cobalt-600 border border-cobalt-100 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-ink-900 truncate">Commercial Tax Invoice — {invoiceNo}</h3>
              <p className="text-[11px] text-slate-500 font-medium">Dashed fields are editable and print as plain text</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-cobalt-600 hover:bg-cobalt-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Printer size={14} />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Close invoice"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable document */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white print:p-0">
          {/* Letterhead */}
          <div className="invoice-block flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-cobalt-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                  {sellerName.slice(0, 2).toUpperCase()}
                </div>
                <h1 className="text-lg sm:text-xl font-black text-ink-900 tracking-tight truncate">{sellerName}</h1>
              </div>
              <EditableField label="Address" value={seller.address} placeholder="Registered legal address" onChange={(v) => patchSeller({ address: v })} wide />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <EditableField label="GSTIN" value={seller.gstin || profile?.gst_number || ''} placeholder="Your 15-character GSTIN" onChange={(v) => patchSeller({ gstin: v })} mono upper />
                <EditableField label="PAN" value={seller.pan} placeholder="AAAAA0000A" onChange={(v) => patchSeller({ pan: v })} mono upper />
              </div>
            </div>

            <div className="sm:text-right space-y-1 shrink-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tax Invoice</p>
              <p className="text-sm font-black text-ink-900 font-mono">{invoiceNo}</p>
              <p className="text-[11px] text-slate-600 font-medium font-mono">Issued: {invoice.issue_date}</p>
              <p className="text-[11px] text-slate-600 font-medium font-mono">Due: {invoice.due_date}</p>
              <span
                className={`inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isPaid ? 'Paid' : 'Payment pending'}
              </span>
            </div>
          </div>

          {/* Billed to */}
          <div className="invoice-block grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Billed To</p>
              <h4 className="font-extrabold text-sm text-ink-900 break-words">{invoice.client?.name || 'Customer'}</h4>
              {invoice.client?.address && <p className="text-xs text-slate-600 mt-0.5 break-words">{invoice.client.address}</p>}
              {invoice.client?.email && <p className="text-xs text-slate-600 mt-0.5 break-all">{invoice.client.email}</p>}
              {invoice.client?.gst_number && (
                <p className="text-xs font-mono text-slate-700 mt-1">
                  GSTIN: <strong>{invoice.client.gst_number}</strong>
                </p>
              )}
            </div>
            <div className="sm:text-right text-xs text-slate-600 space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Supply Details</p>
              <p className="font-medium">
                Place of supply: <strong className="font-mono">{clientState || sellerState || '—'}</strong>
              </p>
              <p className="font-medium">
                Tax type: <strong>{isInterState ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)'}</strong>
              </p>
              {!clientState && <p className="text-[10px] text-slate-400 no-print">Client GSTIN missing: treated as intra-state.</p>}
            </div>
          </div>

          {/* Line items */}
          <div className="invoice-block overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">
                    <span className="sr-only">HSN or </span>HSN/SAC
                  </th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Rate</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">GST %</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {lines.map((l, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 font-bold text-ink-900">{l.description}</td>
                    <td className="py-2.5 px-3 font-mono">
                      <input
                        value={l.hsn_sac || sac}
                        onChange={(e) => setSac(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                        aria-label="HSN or SAC code"
                        className="w-16 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-cobalt-500 font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{l.qty}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{inr(l.unit)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{inr(l.taxable)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{rate}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">{inr(l.taxable * (1 + rate / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + words */}
          <div className="invoice-block grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
            <div className="text-xs space-y-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Amount in words</p>
              <p className="font-bold text-ink-900 leading-snug" data-testid="amount-in-words">{amountInWords(grandTotal)}</p>
            </div>

            <div className="financial-summary-box w-full sm:w-72 space-y-1.5 text-xs border border-slate-200 rounded-2xl p-4">
              <div className="flex justify-between text-slate-600 font-medium font-mono tabular-nums">
                <span>Taxable value</span>
                <span>{inr(taxable)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 font-medium no-print">
                <label htmlFor="gst-rate" className="font-sans">GST rate (%)</label>
                <input
                  id="gst-rate"
                  type="number"
                  min={0}
                  max={28}
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="w-14 text-center border border-slate-200 rounded text-[11px] font-mono py-0.5"
                />
              </div>
              {isInterState ? (
                <div className="flex justify-between text-slate-600 font-medium font-mono tabular-nums">
                  <span>IGST ({rate}%)</span>
                  <span>{inr(totalTax)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600 font-medium font-mono tabular-nums">
                    <span>CGST ({rate / 2}%)</span>
                    <span>{inr(totalTax / 2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-medium font-mono tabular-nums">
                    <span>SGST ({rate / 2}%)</span>
                    <span>{inr(totalTax / 2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-black text-ink-900 border-t-2 border-slate-900 pt-2 font-mono tabular-nums">
                <span>Total</span>
                <span data-testid="invoice-grand-total">{inr(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Remittance */}
          <div className="invoice-block grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 border-t border-slate-200 pt-4">
            <div className="space-y-1.5 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bank remittance details</p>
              <EditableField label="Bank" value={seller.bankName} placeholder="Bank & branch" onChange={(v) => patchSeller({ bankName: v })} wide />
              <EditableField label="A/C No." value={seller.accountNumber} placeholder="Account number" onChange={(v) => patchSeller({ accountNumber: v.replace(/[^0-9]/g, '') })} mono wide />
              <EditableField label="IFSC" value={seller.ifsc} placeholder="IFSC code" onChange={(v) => patchSeller({ ifsc: v })} mono upper wide />
              <EditableField label="UPI ID" value={seller.upiId} placeholder="name@bank" onChange={(v) => patchSeller({ upiId: v.trim() })} mono wide />
              <p className="text-[11px] text-slate-500 font-medium pt-1">
                {invoice.notes || 'Please pay by NEFT / RTGS / UPI on or before the due date, quoting the invoice number.'}
              </p>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-3 shrink-0">
              {upiUri ? (
                <div className="text-center">
                  <QRCodeSVG value={upiUri} size={96} level="M" />
                  <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Scan to pay</p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-medium no-print max-w-[110px] text-center">Add a UPI ID to show a payment QR code.</p>
              )}
              <div className="text-center sm:text-right pt-4 w-40">
                <div className="border-t border-slate-900 pt-1">
                  <input
                    value={seller.signatory}
                    onChange={(e) => patchSeller({ signatory: e.target.value })}
                    placeholder="Authorised signatory"
                    aria-label="Authorised signatory"
                    className="w-full text-center bg-transparent focus:outline-none text-[11px] font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
                  />
                </div>
                <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mt-0.5">For {sellerName}</p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-medium border-t border-slate-100 pt-3">
            This is a computer-generated tax invoice. GSTIN, PAN and bank details are entered by the issuer; Bizpulse does not verify them.
          </p>
        </div>
      </motion.div>
    </div>
  );

  // Portalled outside #root so the print stylesheet can hide the whole app and print only the invoice.
  return createPortal(modal, document.body);
};
