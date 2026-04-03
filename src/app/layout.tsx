import type { Metadata } from 'next';
import { Raleway, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'QC Estimator — Quill Creative Event Design',
  description: 'Internal pricing tool for Quill Creative Event Design',
  icons: {
    icon: '/images/qc-monogram.png',
    apple: '/images/qc-monogram.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${raleway.variable} ${cormorant.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
