import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "SM Budget Tracker",
  description:
    "Stage Management Budget Tracking Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}