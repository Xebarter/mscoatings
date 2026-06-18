'use client';

import Header from '@/components/header';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="pt-20">{children}</div>
    </>
  );
}
