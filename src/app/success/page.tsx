import Link from 'next/link';

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex justify-center items-center bg-ngb-yellow px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 md:p-12 w-full max-w-lg text-center border-0">

        {/* Success Checkmark Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center border-2 border-green-200">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>

        <h2 className="font-exo font-bold text-3xl mb-4 text-black">Exam Submitted</h2>

        <p className="font-libre text-gray-700 text-lg mb-8 leading-relaxed">
          Congratulations! Your Class Bee exam has been securely submitted and recorded.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
          <p className="font-exo font-bold text-gray-800">
            You may now close this tab.
          </p>
        </div>

        <Link
          href="/"
          className="inline-block border-2 border-black bg-transparent text-black px-8 py-3 rounded-full font-bold font-exo hover:bg-black hover:text-ngb-yellow transition-colors"
        >
          Return to Homepage
        </Link>

      </div>
    </div>
  );
}