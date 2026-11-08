export type SubAccountType = 'goal' | 'bucket'

export type SubAccountColor = 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'indigo'

export interface SubAccount {
  id: string
  name: string
  type: SubAccountType
  icon: string
  color: SubAccountColor
  currentAmount: number
  targetAmount: number
  autoSplitPercent: number
  description?: string | null
  targetDate?: Date | null
  completed: boolean
  completedDate?: Date | null
  createdDate: Date
}

export type Goal = SubAccount

export interface Chore {
  id: string
  title: string
  reward: number
  frequency: 'one_time' | 'daily' | 'weekly'
  icon: string
  status: 'open' | 'pending_approval' | 'completed'
  completedByKidAt?: Date | null
  lastApprovedAt?: Date | null
  createdDate: Date
}

export interface KidData {
  id: string
  name: string
  total: number
  parentId: string
  sharedWith: string[]
  public?: boolean
  slug: string
  weeklyAllowance?: number
  allowanceDay?: string
  interestRateMonthly?: number
  interestAppliesTo?: 'total' | 'subaccounts'
  lastInterestPaidAt?: any
  lastAllowancePaidAt?: any
  allowKidSubaccountTransfers?: boolean
  allowKidChoreCheckoff?: boolean
}

export interface Transaction {
  id: string
  amount: number
  description: string
  date: Date
  parentName?: string
  parentEmail?: string
  category?: 'allowance' | 'interest' | 'chore' | 'goal_purchase' | 'deposit' | 'spend'
  subAccountId?: string
  subAccountName?: string
}

export type PlanTier = 'free' | 'pro'

export interface UserSubscription {
  uid: string
  email: string
  tier: PlanTier
  billingCycle?: 'monthly' | 'yearly' | 'founder' | 'trial'
  trialEndsAt?: Date | null
  updatedAt: Date
}
