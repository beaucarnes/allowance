import NavBar from './components/NavBar'
import './globals.css'

export const metadata = {
  title: 'TrackAllowance — The Bank of Mom & Dad | Sub-Accounts, Goals, Chores & AI',
  description:
    "Be your kids' first bank. Track allowances, create sub-account savings jars & goals, pay parent compound interest, manage chores, and update balances by AI.",
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'TrackAllowance — The Modern Bank of Mom & Dad',
    description:
      'Manage your kids allowance with Sub-Accounts, Savings Goals, Parent-Paid Compound Interest, Chores, and an AI Bot API.',
    url: 'https://www.trackallowance.com',
    siteName: 'TrackAllowance',
    type: 'website',
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
      <body className="min-h-screen bg-slate-50/70 text-gray-900 antialiased">
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
