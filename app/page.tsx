import Link from 'next/link'

export default function Home() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-8">Kid's Allowance Tracker</h1>
      <div className="space-x-4">
        <Link href="/kids" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          View Kids
        </Link>
        <Link href="/parent" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Parent Dashboard
        </Link>
      </div>
    </div>
  )
}

