import Navbar from "@/components/shared/navbar";
import Footer from "@/components/shared/footer";
import { JourneyProvider } from "@/components/shared/journey-context";
import { NavigationTracker } from "@/components/shared/navigation-tracker";

export default function ShopperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <JourneyProvider>
      <NavigationTracker />
      <Navbar />
      <main className="flex-grow flex flex-col">{children}</main>
      <Footer />
    </JourneyProvider>
  );
}
