import RestaurantForm from '@/components/RestaurantForm'

export default function NewRestaurantPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            새 맛집 등록
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            발견한 맛집을 추천해주세요
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-8">
          <RestaurantForm />
        </div>
      </main>
    </div>
  )
}
