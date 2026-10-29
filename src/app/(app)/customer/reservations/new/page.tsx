import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BookTableView } from '@/components/customer/book-table-view';

export const metadata: Metadata = { title: 'Book a table' };

export default function BookTablePage() {
  return (
    <Suspense fallback={null}>
      <BookTableView />
    </Suspense>
  );
}
