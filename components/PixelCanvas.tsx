"use client";

import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  Timestamp,
  query,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthAnonymously } from "@/src/useAuthAnonymously";
import PixelCell from "./PixelCell";
import ColorPicker from "./ColorPicker";
import ConfettiAnimation from "./ConfettiAnimation";
import { cn } from "@/lib/utils";
import Image from "next/image";

type Pixel = {
  x: number;
  y: number;
  color: string;
  placedBy: string;
  timestamp: Timestamp;
};

const GRID_SIZE = 24;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const REVEAL_THRESHOLD = 200;

export default function PixelCanvas() {
  const [pixels, setPixels] = useState<Record<string, Pixel>>({});
  const [selectedColor, setSelectedColor] = useState("#FF0000");
  const [placedPixel, setPlacedPixel] = useState(false);
  const { user, loading: authLoading } = useAuthAnonymously();
  const [isAdmin, setIsAdmin] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [gridColors, setGridColors] = useState<string[][]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [totalPlaced, setTotalPlaced] = useState(0);
  const [audienceCount, setAudienceCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [animationFrame, setAnimationFrame] = useState(0);
  
  // Animate colors over time
  useEffect(() => {
    if (!isRevealed) return;
    
    const animate = () => {
      setAnimationFrame(prev => (prev + 0.005) % (2 * Math.PI));
      requestAnimationFrame(animate);
    };
    
    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isRevealed]);
  interface GlowColor {
    base: string;
    light: string;
    lighter: string;
    shadow: string;
    nextHue: number;
  }

  const [glowCells, setGlowCells] = useState<{index: number, color: GlowColor}[]>([]);

  // Generate random grid colors
  const generateRandomColors = () => {
    const colors = [];
    for (let y = 0; y < 30; y++) {
      const row = [];
      for (let x = 0; x < 30; x++) {
        row.push(`#${Math.floor(Math.random()*16777215).toString(16)}`);
      }
      colors.push(row);
    }
    return colors;
  };

  // Initialize grid colors and generate random glow cells
  useEffect(() => {
    setGridColors(generateRandomColors());
    
    // Generate random glow cells for top and bottom 3 rows
    const newGlowCells: {index: number, color: GlowColor}[] = [];
    
    // Helper function to generate random color with next target hue
    const getRandomColor = () => {
      const hue = Math.floor(Math.random() * 360);
      return {
        base: `hsl(${hue}, 80%, 60%)`,
        light: `hsla(${hue}, 80%, 60%, 0.3)`,
        lighter: `hsla(${hue}, 80%, 60%, 0.2)`,
        shadow: `hsla(${hue}, 80%, 60%, 0.8)`,
        nextHue: (hue + 30 + Math.floor(Math.random() * 3000)) % 360
      };
    };
    
    // Add all cells from top 3 rows (0-2)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const index = row * GRID_SIZE + col;
        newGlowCells.push({
          index,
          color: getRandomColor()
        });
      }
    }
    
    // Add all cells from bottom 3 rows
    for (let row = GRID_SIZE - 3; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const index = row * GRID_SIZE + col;
        newGlowCells.push({
          index,
          color: getRandomColor()
        });
      }
    }
    
    setGlowCells(newGlowCells);
    
    // Start the reveal animation after a short delay
    const timer = setTimeout(() => {
      setIsAnimating(true);
      // Start the reveal after animation completes
      setTimeout(() => setReveal(true), 2000);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Fetch pixels after reveal
  useEffect(() => {
    if (reveal) {
      const q = query(collection(db, "pixels"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newPixels: Record<string, Pixel> = {};
        snapshot.forEach((doc) => {
          const data = doc.data() as Pixel;
          newPixels[`${data.x}-${data.y}`] = data;
        });
        setPixels(newPixels);
        setTotalPlaced(snapshot.size);

        if (snapshot.size >= REVEAL_THRESHOLD) {
          setIsRevealed(true);
        }
      });

      return () => unsubscribe();
    }
  }, [reveal]);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const checkUserStatus = async () => {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().hasPlaced) {
        setPlacedPixel(true);
      }
    };
    checkUserStatus();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, "pixels"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPixels: Record<string, Pixel> = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as Pixel;
        newPixels[`${data.x}-${data.y}`] = data;
      });
      setPixels(newPixels);
      setTotalPlaced(snapshot.size);

      if (snapshot.size >= REVEAL_THRESHOLD) {
        setIsRevealed(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Track active users
    const presenceRef = doc(db, "presence", "activeUsers");
    const userId = user?.uid || `anonymous-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up presence
    const userStatusDatabaseRef = doc(db, "status", userId);
    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: Timestamp.now(),
    };

    const isOnlineForDatabase = {
      state: 'online',
      last_changed: Timestamp.now(),
    };

    // Set up user's online status
    const userStatusRef = doc(db, "status", userId);
    setDoc(userStatusRef, isOnlineForDatabase);

    // Update audience count when status changes
    const statusQuery = collection(db, "status");
    const statusUnsubscribe = onSnapshot(statusQuery, (snapshot) => {
      const onlineUsers = snapshot.docs.filter(doc => doc.data().state === 'online');
      // Cap at 200 as requested
      setAudienceCount(Math.min(onlineUsers.length, 200));
    });

    // Cleanup function
    return () => {
      // Set user as offline when they leave
      setDoc(userStatusRef, isOfflineForDatabase);
      statusUnsubscribe();
    };
  }, [user]);

  const handlePlacePixel = async (x: number, y: number) => {
    if (!user || placedPixel || authLoading) return;
    try {
      const res = await fetch("/api/place-pixel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          x,
          y,
          color: selectedColor,
          userId: user.uid,
        }),
      });

      if (res.ok) {
        setPlacedPixel(true);
      } else {
        const errorData = await res.json();
        console.log(errorData);
        alert(errorData.error);
      }
    } catch (error) {
      console.error("Failed to place pixel:", error);
      alert("Failed to place pixel. Please try again.");
    }
  };

  const canvasStyle = {
    gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
  };

  return (
    <main className="flex flex-col items-center justify-center p-8 bg-black min-h-screen">
      <div className="relative z-10 text-center mb-6">
        <h1 className="text-4xl font-bold mb-2 text-white">Pixel Canvas Club</h1>
        <p className="text-lg text-gray-300">
          Place your one pixel to help reveal the hidden logo!
        </p>
      </div>
      
      <div className="flex justify-center gap-8 mb-6">
        <div className="text-xl font-medium">
          Pixels Placed: <span className="text-primary font-bold">{totalPlaced}</span> / {REVEAL_THRESHOLD}
        </div>
        <div className="text-xl font-medium">
          Audience: <span className="text-blue-600 font-bold">{audienceCount}</span> / 200
        </div>
      </div>

      <div className="mb-6">
        <ColorPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
        />
      </div>

      <div className="relative w-full max-w-2xl aspect-square border-4 border-gray-800 shadow-2xl bg-black overflow-hidden">
        {/* Show logo when 200 pixels are placed */}
        {totalPlaced >= 200 && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Image
              src="/coding_club_final.png"
              alt="Coding Club Logo"
              width={500}
              height={500}
              className="object-contain w-full h-full opacity-90"
            />
          </div>
        )}
        {isRevealed && (
          <>
            <ConfettiAnimation />
            <div className="absolute inset-0 z-10 opacity-100 transition-opacity duration-1000">
              <Image
                src="/coding-club-logo-mask.png"
                alt="Hidden Logo"
                layout="fill"
                objectFit="contain"
              />
            </div>
          </>
        )}
        <div className="relative w-full h-full">
          {/* Canvas Glow Effect */}
          <div 
            className="absolute inset-0 -m-4 z-10 opacity-70"
            style={{
              background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
              filter: 'blur(16px)',
              pointerEvents: 'none',
            }}
          />
          <div
            className={cn(
              "grid w-full h-full relative z-20",
              isRevealed && "opacity-0 transition-opacity duration-1000"
            )}
            style={canvasStyle}
          >
          {totalPlaced < 200 ? (
            // Show grid before reveal
            [...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => {
              const x = i % GRID_SIZE;
              const y = Math.floor(i / GRID_SIZE);
              const pixel = pixels[`${x}-${y}`];
              return (
                <PixelCell
                  key={i}
                  x={x}
                  y={y}
                  color={pixel?.color || ""}
                  isPlaced={!!pixel}
                  onClick={handlePlacePixel}
                  disabled={placedPixel || authLoading}
                  selectedColor={selectedColor}
                />
              );
            })
          ) : (
            // After reveal, show empty cells with colored glow in top and bottom 3 rows
            [...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => {
              const x = i % GRID_SIZE;
              const y = Math.floor(i / GRID_SIZE);
              const pixel = pixels[`${x}-${y}`];
              const glowCell = glowCells.find(cell => cell.index === i);
              const glowColor = glowCell?.color;
              return (
                <div 
                  key={i} 
                  className={`aspect-square border border-gray-800/30 relative overflow-visible`}
                >
                  {(glowColor || pixel?.color) && (
                    <>
                      {/* Base glow layer */}
                      <div 
                        className="absolute inset-0 rounded-sm"
                        style={{
                          backgroundColor: pixel?.color || glowColor?.base || 'transparent',
                          opacity: 0.8,
                          transition: 'all 0.3s ease-in-out',
                          animation: (pixel?.color || glowColor) ? 'pulse 2s infinite' : 'none',
                          animationDelay: (pixel?.color || glowColor) ? `${(i % 10) * 0.1}s` : '0s'
                        }}
                      />
                      {/* Outer glow layer */}
                      <div 
                        className="absolute inset-0 rounded-sm"
                        style={{
                          backgroundColor: pixel?.color || glowColor?.base || 'transparent',
                          opacity: 0.6,
                          boxShadow: (pixel?.color || glowColor) 
                            ? `0 0 15px 5px ${pixel?.color || glowColor?.base}` 
                            : 'none',
                          filter: 'blur(3px)',
                          transition: 'all 0.3s ease-in-out'
                        }}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
      {placedPixel && (
        <p className="mt-4 text-green-600 font-semibold">
          ✅ Your pixel has been placed! Thank you.
        </p>
      )}
    </main>
  );
}
