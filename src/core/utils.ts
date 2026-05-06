import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhoneNumber(phone: string) {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) {
    p = '84' + p.substring(1);
  } else if (!p.startsWith('84')) {
    p = '84' + p;
  }
  return '+' + p;
}

export function formatCurrency(amount: number, currency: string = 'VND') {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
  }).format(d);
}

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        let val = row[header];
        if (typeof val === 'string') val = `"${val.replace(/"/g, '""')}"`;
        if (val instanceof Date) val = formatDate(val);
        return val;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
