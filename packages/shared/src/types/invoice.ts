export interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  groupId: string;
  total: number;
  paidBy: string;
  createdAt: string;
}
