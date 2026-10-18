import type { ReactNode } from 'react';
import './customer.css';
import './checkout.css';
import { CustomerShell } from '@/components/customer/customer-shell';
import { ToastProvider } from '@/components/ui/toast';

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <CustomerShell>{children}</CustomerShell>
    </ToastProvider>
  );
}
