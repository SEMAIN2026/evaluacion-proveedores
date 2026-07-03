import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Evaluación de Proveedores · F-CAL-07 REV01",
  description: "Sistema web para evaluar proveedores: 10 criterios, calificación automática, gráfica comparativa, PDF y envío por correo.",
  keywords: ["evaluación", "proveedores", "F-CAL-07", "calidad", "compras", "supplier", "evaluation"],
  authors: [{ name: "Walter Piñera" }],
  openGraph: {
    title: "Evaluación de Proveedores",
    description: "Sistema web para evaluar proveedores con gráfica comparativa, PDF y envío por correo.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Evaluación de Proveedores",
    description: "Sistema web para evaluar proveedores con gráfica comparativa, PDF y envío por correo.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
