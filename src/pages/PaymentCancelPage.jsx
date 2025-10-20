

import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { FiXCircle, FiArrowLeft } from "react-icons/fi"
import { message } from "antd"

function PaymentCancelPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      const errorMessages = {
        'payment_cancelled': 'Payment was cancelled',
        'payment_not_completed': 'Payment was not completed',
        'missing_session_id': 'Invalid payment session',
        'missing_metadata': 'Invalid payment data',
        'payment_record_not_found': 'Payment record not found'
      }
      message.warning(errorMessages[error] || 'Payment was cancelled')
    }
  }, [searchParams])

  const handleRetry = () => {
    // Check if there's pending registration data
    const pendingRegistration = localStorage.getItem('pendingRegistration')
    if (pendingRegistration) {
      try {
        const data = JSON.parse(pendingRegistration)
        // Go back to registration with plan pre-selected
        navigate(`/register?step=2&plan=${data.plan?.id || 'starter'}`)
      } catch {
        navigate('/register')
      }
    } else {
      navigate('/register')
    }
  }

  const handleGoToLogin = () => {
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
          <FiXCircle className="text-orange-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-gray-600 mb-6">
          Your payment was cancelled or could not be processed. Don't worry, you can try again or come back later.
        </p>

        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>No charges were made to your card</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Your registration details are saved</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>You can complete payment anytime</span>
            </li>
          </ul>
        </div>

          <div className=' flex items-center gap-3 '>
          <button
            onClick={handleRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
            type="button"
          >
            <FiArrowLeft size={18} />
            Try Payment Again
          </button>
          <button
            onClick={handleGoToLogin}
            className="w-full inline-flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 px-4 rounded-lg transition"
          >
            <FiArrowLeft size={16} className="mr-2" />
            Go to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaymentCancelPage