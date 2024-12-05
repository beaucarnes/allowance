export default function AccessDenied() {
  // Get the current URL to redirect back after login
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
  
  return (
    <div className="text-center py-12">
      <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
      <p className="text-gray-600 mb-6">This page is private.</p>
      <a 
        href={`/parent?redirect=${currentPath}`}
        className="text-blue-500 hover:text-blue-700"
      >
        Sign in to view this page
      </a>
    </div>
  )
} 