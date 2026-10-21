import type { ReactNode } from 'react';
import './admin.css';
import { AdminShell } from '@/components/admin/admin-shell';
import { ToastProvider } from '@/components/ui/toast';

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AdminShell>{children}</AdminShell>
    </ToastProvider>
  );
}
