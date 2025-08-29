import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata: Metadata = {
  title: "Go Prompt!",
  description: "Create customizable HTML buttons that link to ChatGPT with custom prompts and search hints for newsletters, blogs, and websites without writing any code.",
  keywords: ["button generator", "newsletter", "HTML", "no-code", "web design", "chatgpt", "prompt"],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        elements: {
          formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
        },
      }}
    >
      <html lang="en">
        <body className="antialiased">
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
