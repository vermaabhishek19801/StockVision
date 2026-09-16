export default function LoadingSpinner({ size = 'lg', text = 'Loading...' }) {
  const s = size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-8 w-8' : 'h-12 w-12'
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-gray-950">
      <div className={`${s} border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin`} />
      {text && <p className="text-gray-400 text-sm">{text}</p>}
    </div>
  )
}
