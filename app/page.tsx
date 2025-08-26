import dynamic from 'next/dynamic';

const PixelCanvas = dynamic(() => import('@/components/PixelCanvas'), {
  ssr: false,
});

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-4 text-center">Pixel Canvas Club</h1>
        <p className="text-lg text-gray-600 mb-6 text-center">
          An interactive activity where we reveal our Coding Club logo one pixel at a time.
        </p>
        <div className="mt-8 p-6 bg-white shadow-md rounded-lg max-w-2xl text-center">
          <h2 className="text-2xl font-semibold mb-4">How it Works</h2>
          <ol className="list-decimal list-inside text-left space-y-2">
            <li>You can anonymously place **exactly one pixel** on the canvas.</li>
            <li>Choose a color and click any empty square.</li>
            <li>Your pixel will instantly appear for everyone.</li>
            <li>Once 300 pixels are placed, the hidden logo will be revealed!</li>
          </ol>
        </div>
      </div>
      <div className="mt-8">
        <PixelCanvas />
      </div>
    </main>
  );
}
