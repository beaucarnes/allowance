import Link from 'next/link'

interface KidData {
  id: string;
  name: string;
  total: number;
  parentId: string;
  sharedWith: string[];
  public?: boolean;
  slug: string;
}

export default function KidsList({ kids }: { kids: KidData[] }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Kids List</h1>
      <div className="mt-8">
        {kids.map(kid => (
          <Link key={kid.id} href={`/${kid.slug}`}>
            <div className="border rounded-md p-4 mb-4">
              <h2 className="text-2xl font-bold">{kid.name}</h2>
              <p>Total: ${kid.total}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
} 