import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@coldfi/shared';

export interface ReceiptItem {
  name: string;
  amount: number;
}

export interface ReceiptData {
  type: 'personal' | 'group';
  receiptNumber: string;
  date: string;
  description: string;
  category: string;
  currency: string;
  paidBy: string;
  paidByDisplay: string;
  totalAmount: number;
  yourShare?: number;
  items?: ReceiptItem[];
  splits?: { name: string; amount: number }[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function downloadReceiptPDF(data: ReceiptData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentW = pageW - 2 * margin;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('COLLECTIFY', pageW / 2, 16, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Receipt', pageW / 2, 22, { align: 'center' });

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, 25, pageW - margin, 25);

  // Receipt info
  doc.setTextColor(60);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt #:', margin, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(data.receiptNumber, margin + 22, 32);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.date), margin + 22, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Type:', margin, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(data.type === 'group' ? 'Group Expense' : 'Personal Expense', margin + 22, 44);

  // Description (truncate to fit width)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  const descLines = doc.splitTextToSize(data.description, contentW);
  const descLineCount = Math.min(descLines.length, 2);
  doc.text(descLines.slice(0, 2), margin, 54);

  // Category + Paid by
  const infoY = 54 + descLineCount * 5 + 2;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Category: ${data.category}`, margin, infoY);
  const paidByY = infoY + 6;
  if (data.type === 'group') {
    doc.text(`Paid by: ${data.paidByDisplay}`, margin, paidByY);
  }

  // Divider
  const divY = (data.type === 'group' ? paidByY : infoY) + 4;
  doc.setDrawColor(200);
  doc.line(margin, divY, pageW - margin, divY);

  // Items table
  let startY = divY + 4;
  if (data.items && data.items.length > 0) {
    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      head: [['Item', 'Amount']],
      body: data.items.map((i) => [i.name, formatCurrency(i.amount, data.currency)]),
      theme: 'plain',
      headStyles: {
        fontStyle: 'bold',
        fontSize: 8,
        fillColor: [245, 245, 245],
        textColor: [60, 60, 60],
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.7 },
        1: { cellWidth: contentW * 0.3, halign: 'right' },
      },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.1,
    });
    if ((doc as any).lastAutoTable) startY = (doc as any).lastAutoTable.finalY + 4;
  }

  // Splits table (group only)
  if (data.type === 'group' && data.splits && data.splits.length > 0) {
    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      tableWidth: contentW,
      head: [['Member', 'Owes']],
      body: data.splits.map((s) => [s.name, formatCurrency(s.amount, data.currency)]),
      theme: 'plain',
      headStyles: {
        fontStyle: 'bold',
        fontSize: 8,
        fillColor: [245, 245, 245],
        textColor: [60, 60, 60],
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.5 },
        1: { cellWidth: contentW * 0.5, halign: 'right' },
      },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.1,
    });
    if ((doc as any).lastAutoTable) startY = (doc as any).lastAutoTable.finalY + 4;
  }

  // Total
  const totalY = startY + 4;
  doc.setDrawColor(200);
  doc.line(margin, totalY, pageW - margin, totalY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Total:', margin, totalY + 7);
  doc.text(formatCurrency(data.totalAmount, data.currency), pageW - margin, totalY + 7, { align: 'right' });

  if (data.yourShare !== undefined && data.yourShare !== data.totalAmount) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text('Your share:', margin, totalY + 13);
    doc.text(formatCurrency(data.yourShare, data.currency), pageW - margin, totalY + 13, { align: 'right' });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(160);
  doc.text('Generated by Collectify', pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  // Save
  doc.save(`receipt_${data.receiptNumber}.pdf`);
}
