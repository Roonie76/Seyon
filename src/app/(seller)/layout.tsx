import SellerNavbar from "@/components/shared/seller-navbar";
import SellerFooter from "@/components/shared/seller-footer";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SellerNavbar />
      <main className="flex-grow flex flex-col">{children}</main>
      <SellerFooter />
    </>
  );
}
