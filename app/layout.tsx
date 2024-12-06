import NavBar from './components/NavBar'
import './globals.css'

export const metadata = {
  title: 'Track Allowance',
  description: "The modern way to manage your children's allowance",
  icons: {
    icon: '/favicon.ico',
    // You can also add different sizes if you want
    // apple: '/apple-icon.png',
    // shortcut: '/favicon-16x16.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head />
      <body>
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}

