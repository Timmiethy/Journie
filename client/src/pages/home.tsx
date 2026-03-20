export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream-50 px-4 py-4">
      <div className="w-full max-w-[480px] mx-auto">
        <div className="flex justify-between items-center mb-5">
          <h1 className="font-sans text-[17px] font-medium text-ink-900">journie</h1>
          <span className="font-sans text-[12px] text-accent-400 border border-accent-200 rounded-[16px] px-[10px] py-1">
            my journal
          </span>
        </div>
        {/* TODO: Camera capture, today's moments feed, start journaling CTA */}
        <p className="text-ink-500 text-[13px] text-center mt-8">Capture hub coming soon</p>
      </div>
    </div>
  );
}
