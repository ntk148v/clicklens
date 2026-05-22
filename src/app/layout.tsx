import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { withBasePath } from "@/lib/base-path";
import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/ui/toaster";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClickLens - ClickHouse Observability UI",
  description:
    "Modern, open-source, Kibana-like web UI for ClickHouse. SQL-native, minimal, fast.",
  keywords: [
    "ClickHouse",
    "SQL",
    "database",
    "monitoring",
    "observability",
    "analytics",
  ],
  icons: {
    icon: withBasePath("/logo.png"),
    shortcut: withBasePath("/logo.png"),
    apple: withBasePath("/apple-touch-icon.png"),
    other: [
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        url: withBasePath("/android-chrome-192x192.png"),
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "512x512",
        url: withBasePath("/android-chrome-512x512.png"),
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read nonce from the request headers to force dynamic rendering
  // This ensures Next.js injects the dynamic nonce into inline scripts
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") || "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
