import Navbar from "@/components/shared/navbar";
import Footer from "@/components/shared/footer";

export default function ShopperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-grow flex flex-col">{children}</main>
      <Footer />
    </>
  );
}
