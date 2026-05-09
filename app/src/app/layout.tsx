import type { Metadata } from "next";
import "./globals.css";
import { SolanaProvider } from "@/components/wallet/WalletProvider";
import { Nav } from "./Nav";

export const metadata: Metadata = {
  title: "FluxSentinel — RWA Stablecoin",
  description: "Real-time security scoring for RWA-backed stablecoin on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <SolanaProvider>
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </SolanaProvider>
      </body>
    </html>
  );
}
