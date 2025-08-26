import dynamic from 'next/dynamic';

const PixelCanvas = dynamic(() => import('@/components/PixelCanvas'), {
  ssr: false,
});

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      <PixelCanvas />
    </div>
  );
}
