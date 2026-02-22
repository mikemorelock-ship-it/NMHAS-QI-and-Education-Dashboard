import { NMH_COLORS } from "@/lib/constants";

/**
 * Standalone layout for publicly shared campaign reports.
 * No authentication, no navigation — just a branded header + content.
 */
export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header
        className="w-full h-14 flex-shrink-0 flex items-center px-4 md:px-6"
        style={{ backgroundColor: NMH_COLORS.teal }}
      >
        <span className="text-white font-bold text-base md:text-lg tracking-tight whitespace-nowrap">
          North Memorial Health Ambulance Services
        </span>
      </header>
      <main className="flex-1 w-full overflow-y-auto">{children}</main>
    </div>
  );
}
