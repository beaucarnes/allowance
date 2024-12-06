import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Kid's Allowance Tracker</h1>
        <p className="text-xl text-gray-600 mb-8">
          A simple way to manage your children's allowance online and teach financial responsibility.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        <FeatureCard
          title="Track Balances"
          description="Keep track of allowances, gifts, and spending in one place. Always know exactly how much money each child has."
        />
        <FeatureCard
          title="Automatic Allowances"
          description="Set up weekly allowances that automatically add to your child's balance. Choose any day of the week."
        />
        <FeatureCard
          title="Share Access"
          description="Safely share view-only access with family members. Perfect for grandparents who want to contribute."
        />
        <FeatureCard
          title="Kid-Friendly Dashboard"
          description="Give your kids their own dashboard to check their balance and transaction history."
        />
        <FeatureCard
          title="Privacy Controls"
          description="Choose whether each child's dashboard is private or public. You're in complete control."
        />
        <FeatureCard
          title="Transaction History"
          description="Keep a detailed record of all money movements. Great for teaching kids about saving and spending."
        />
      </div>

      <div className="text-center">
        <Link 
          href="/parent"
          className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
        >
          Get Started Free
        </Link>
        <p className="mt-4 text-gray-600">
          Completely free with no ads.
        </p>
        <p className="mt-8 text-sm text-gray-500">
          Created by <a 
            href="https://github.com/beaucarnes"
            target="_blank"
            rel="noopener noreferrer" 
            className="text-blue-500 hover:text-blue-700"
          >
            Beau Carnes.
          </a>
        </p>
      </div>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

