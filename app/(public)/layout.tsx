import Header from '@/components/header';
import Footer from '@/components/footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="pt-20">{children}</div>
      <Footer />
    </>
  );
}
