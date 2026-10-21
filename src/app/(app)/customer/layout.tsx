import type { ReactNode } from 'react';
import './customer.css';
import './checkout.css';
import './orders.css';
import './account.css';
import './support.css';
import './settings.css';
import { AppPrefsApplier } from '@/components/customer/app-prefs-applier';
import { CustomerShell } from '@/components/customer/customer-shell';
import { ToastProvider } from '@/components/ui/toast';

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppPrefsApplier />
      <CustomerShell>{children}</CustomerShell>
    </ToastProvider>
  );
}
