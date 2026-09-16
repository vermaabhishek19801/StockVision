import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-gray-800">404</h1>
        <h2 className="text-xl font-semibold text-white mt-4">Page Not Found</h2>
        <p className="text-gray-400 mt-2">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 mt-6">
          <FiArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
