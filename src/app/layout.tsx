import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'National Geography Bee',
  description: 'National Geography Bee Competition Platform',
  icons: {
    icon: '/ngb-logo-square.png',
    apple: '/ngb-logo-square.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/ngb-logo-square.png" />
        <link rel="apple-touch-icon" href="/ngb-logo-square.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="font-libre bg-ngb-yellow text-black min-h-screen flex flex-col m-0 p-0 box-border">
        {children}
      </body>
    </html>
  );
}