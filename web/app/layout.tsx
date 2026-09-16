import type { Metadata } from "next";
import "./globals.css";
import "./check-name.css";

export const metadata: Metadata = {
  title: "check name na | เช็คชื่อเข้าเรียน",
  description: "เช็คชื่อเข้าเรียน วิทยาลัยการอาชีพเถิน อาจารย์ปภังกร บุตรศรี",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
