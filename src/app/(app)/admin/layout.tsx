import type { ReactNode } from 'react';
import '../owner/admin.css';
import { AdminShell } from '@/components/admin/admin-shell';
import { ToastProvider } from '@/components/ui/toast';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AdminShell area="platform">{children}</AdminShell>
    </ToastProvider>
  );
}
