'use client'

import React from 'react'
import Link from 'next/link'
import KidSettings from '@/app/components/KidSettings'
import ShareAccess from '@/app/components/ShareAccess'
import DashboardVisibility from '@/app/components/DashboardVisibility'
import AccountDetails from '@/app/components/AccountDetails'

type KidData = {
  id: string;
  name: string;
  total: number;
  parentId: string;
  sharedWith: string[];
  public?: boolean;
  slug: string;
  weeklyAllowance?: number;
  allowanceDay?: string;
}

export default function SettingsPage({ kid }: { kid: KidData }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Settings for {kid.name}</h1>
        <Link
          href={`/parent/kid/${kid.slug}`}
          className="text-gray-600 hover:text-gray-800"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="space-y-8">
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Weekly Allowance</h2>
          <KidSettings 
            kidId={kid.id}
            initialAllowance={kid.weeklyAllowance || 0}
            initialAllowanceDay={kid.allowanceDay || 'Sunday'}
            isOwner={true}
          />
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Kid Dashboard Visibility</h2>
          <DashboardVisibility 
            kidId={kid.id}
            isPublic={kid.public || false}
          />
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <ShareAccess 
            kidId={kid.id} 
            sharedWith={kid.sharedWith || []} 
          />
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Account Details</h2>
          <AccountDetails 
            kidId={kid.id}
            initialName={kid.name}
            initialSlug={kid.slug}
          />
        </section>
      </div>
    </div>
  )
} 