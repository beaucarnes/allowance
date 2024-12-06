import Link from 'next/link'

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">How to Use Track Allowance</h1>

      <div className="space-y-12">
        {/* Getting Started */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <p>1. Sign in with your Google account from the Parent Dashboard</p>
            <p>2. Click "Add New Kid" to create your first kid's account</p>
            <p>3. Enter their name and choose a unique URL for their dashboard</p>
          </div>
        </section>

        {/* Managing Transactions */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Managing Transactions</h2>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Adding Transactions</h3>
              <p>For each transaction, enter:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                <li>Amount: How much money is involved</li>
                <li>Type: Choose "Credit" for money received or "Debit" for money spent</li>
                <li>Date: When the transaction occurred</li>
                <li>Description: What the transaction was for (e.g., "Birthday money" or "Bought toys")</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Editing & Deleting</h3>
              <p>Click "Edit" to modify a transaction's details</p>
              <p>Click "Delete" to remove a transaction (cannot be undone)</p>
            </div>
          </div>
        </section>

        {/* Weekly Allowance */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Weekly Allowance</h2>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <p>Set up automatic weekly allowance in the Settings page:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Enter the weekly amount</li>
              <li>Choose which day of the week it should be added</li>
              <li>The amount will be automatically added every week</li>
            </ol>
          </div>
        </section>

        {/* Sharing Access */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Sharing Access</h2>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <p>Share view/edit access with other family members:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to the kid's Settings page</li>
              <li>Enter the email address of the person you want to share with</li>
              <li>They'll be able to view and add transactions</li>
              <li>Only the account owner can modify settings or delete the account</li>
            </ol>
          </div>
        </section>

        {/* Privacy Settings */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Privacy Settings</h2>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Private Dashboard (Default)</h3>
              <p>Only you and people you've shared access with can view the kid's dashboard</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Public Dashboard</h3>
              <p>Anyone with the link can view the kid's dashboard (but cannot make changes)</p>
              <p>Useful for sharing with extended family or the kid themselves</p>
            </div>
          </div>
        </section>

        {/* Account Management */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Account Management</h2>
          <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <p>From the Settings page you can:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Change the kid's name</li>
              <li>Update their dashboard URL</li>
              <li>Modify sharing settings</li>
              <li>Delete the account (this cannot be undone)</li>
            </ul>
          </div>
        </section>

        <div className="text-center pt-8">
          <Link 
            href="/parent"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
          >
            Go to Parent Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
} 