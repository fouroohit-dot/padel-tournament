import "./globals.css";

export const metadata = {
  title: "AP | Padel Championship",
  description: "AP Padel Championship — Live Scores",
  icons: {
    icon: "/ap-logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
