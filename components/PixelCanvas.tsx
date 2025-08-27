"use client";

import React, { useState, useEffect, useRef } from "react";
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
const REVEAL_THRESHOLD = 11;

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
  const [currentQuote, setCurrentQuote] = useState('');
  const [showQuote, setShowQuote] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const quoteTimeout = useRef<NodeJS.Timeout>();
  
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

  // Initialize grid colors
  useEffect(() => {
    setGridColors(generateRandomColors());
    
    // Start the reveal after a short delay
    const timer = setTimeout(() => {
      setReveal(true);
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
          setShowLoader(true);
          setShowGlow(true);
          
          // Only generate glow cells when threshold is met
          const newGlowCells: {index: number, color: GlowColor}[] = [];
          
          const getRandomColor = () => {
            const hue = Math.floor(Math.random() * 360);
            return {
              base: `hsl(${hue}, 80%, 60%`,
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

  const quotes = [
    "Creating something beautiful...",
    "Unleashing creativity...",
    "Pixel by pixel, art comes to life...",
  ];

  const showRandomQuote = () => {
    let currentIndex = 0;
    
    const showNextQuote = () => {
      if (currentIndex >= quotes.length) {
        setShowQuote(false);
        // Reset for next cycle
        quoteTimeout.current = setTimeout(showRandomQuote, 3000);
        return;
      }
      
      setCurrentQuote(quotes[currentIndex]);
      setShowQuote(true);
      currentIndex++;
      
      // Show next quote after 1 second
      quoteTimeout.current = setTimeout(showNextQuote, 2000);
    };
  
    // Clear any existing timeouts
    if (quoteTimeout.current) {
      clearTimeout(quoteTimeout.current);
    }
    
    showNextQuote();
  };
  
  // Show loader and quotes until REVEAL_THRESHOLD is reached
  useEffect(() => {
    if (showLoader) {
      showRandomQuote();
      
      // Check if we've already reached the threshold
      if (totalPlaced >= REVEAL_THRESHOLD) {
        setShowQuote(false);
        setTimeout(() => {
          setShowLoader(false);
          setIsRevealed(true);
        }, 300);
        if (quoteTimeout.current) clearTimeout(quoteTimeout.current);
        return;
      }
      
      // If not at threshold yet, check periodically
      const checkThreshold = setInterval(() => {
        if (totalPlaced >= REVEAL_THRESHOLD) {
          setShowQuote(false);
          setTimeout(() => {
            setShowLoader(false);
            setIsRevealed(true);
          }, 300);
          if (quoteTimeout.current) clearTimeout(quoteTimeout.current);
          clearInterval(checkThreshold);
        }
      }, 1000);
      
      return () => {
        clearInterval(checkThreshold);
        if (quoteTimeout.current) clearTimeout(quoteTimeout.current);
      };
    }
  }, [showLoader, totalPlaced]);

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
          Pixels Placed: <span className="text-primary font-bold">{totalPlaced}</span>
        </div>
        <div className="text-xl font-medium">
          Audience: <span className="text-blue-600 font-bold">{audienceCount}</span> 
        </div>
      </div>

      <div className="mb-6">
        <ColorPicker
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
        />
      </div>

      <div className="relative w-full max-w-2xl aspect-square border-4 border-gray-800 shadow-2xl bg-black overflow-hidden transition-all duration-500 ease-in-out">
        {/* Show loader and quotes with smooth transition */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${showLoader ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {showLoader && (
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-20 h-20 mb-6 transform transition-all duration-500 hover:scale-110">
              <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-blue-400 animate-spin" style={{ animationDuration: '1.5s' }}></div>
              <div className="absolute inset-1 rounded-full border-4 border-t-transparent border-pink-400 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
              <div className="absolute inset-2 rounded-full border-4 border-t-transparent border-purple-400 animate-spin" style={{ animationDuration: '2.5s' }}></div>
              <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-white/30 animate-ping" style={{ animationDuration: '3s' }}></div>
            </div>
            <div 
              className={`text-xl font-medium text-center transition-all duration-500 transform ${
                showQuote ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
              }`}
              style={{
                textShadow: '0 0 15px rgba(255,255,255,0.8)',
                background: 'linear-gradient(90deg, #fff, #ccc, #fff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% auto',
                animation: 'textShine 3s linear infinite'
              }}
            >
              {currentQuote}
            </div>
            <ConfettiAnimation />
          </div>
        )}
        </div>
        {isRevealed && totalPlaced >= REVEAL_THRESHOLD && (
          <>
            <ConfettiAnimation />
            <div className={`absolute inset-0 z-0 transition-all duration-1000 ease-in-out ${
              showLoader ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}>
              <Image
                src="/coding_club_final.png"
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
            className="absolute inset-0 -m-4 z-0 opacity-70"
            style={{
              background: 'radial-gradient(circle at center, rgba(100, 180, 255, 0.15) 0%, transparent 80%)',
              filter: 'blur(16px)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="grid w-full h-full relative z-10"
            style={canvasStyle}
          >
          {[...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const pixel = pixels[`${x}-${y}`];
            const isGlowingRow = y < 3 || y >= GRID_SIZE - 3;
            const glowCell = isGlowingRow ? glowCells.find(cell => cell.index === i) : null;
            const glowColor = glowCell?.color;

            if (pixel) {
              return (
                <div 
                  key={i}
                  className="relative aspect-square"
                  style={{
                    background: `linear-gradient(135deg, ${pixel.color} 0%, ${pixel.color}99 100%)`,
                    boxShadow: `0 0 12px 2px ${pixel.color}80`,
                    animation: 'pulse 0.8s infinite cubic-bezier(0.4, 0, 0.6, 1)',
                    animationDelay: `${(i % 10) * 0.03}s`,
                    border: '1px solid rgba(255,255,255,0.15)',
                    transform: 'translateZ(0)',
                    willChange: 'transform, opacity'
                  }}
                />
              );
            }

            if (isGlowingRow && glowColor) {
              return (
                <div 
                  key={i}
                  className="relative aspect-square"
                  onClick={() => handlePlacePixel(x, y)}
                  style={{
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div 
                    className="absolute inset-0 rounded-sm transition-all duration-300 hover:opacity-100"
                    style={{
                      backgroundColor: glowColor.base,
                      opacity: 0.25,
                      boxShadow: `0 0 15px 4px ${glowColor.base}80`,
                      animation: 'pulse 0.7s infinite cubic-bezier(0.4, 0, 0.6, 1)',
                      animationDelay: `${(i % 10) * 0.02}s`,
                      transform: 'translateZ(0)',
                      willChange: 'transform, opacity',
                      transition: 'all 0.2s ease-out'
                    }}
                  />
                </div>
              );
            }

            return (
              <PixelCell
                key={i}
                x={x}
                y={y}
                color=""
                isPlaced={false}
                onClick={handlePlacePixel}
                disabled={placedPixel || authLoading}
                selectedColor={selectedColor}
              />
            );
          })}
          {totalPlaced >= 200 && (
            // Force re-render to get new random colors when quotes change
            <React.Fragment key={currentQuote}>
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="relative w-20 h-20 mb-6" key={Date.now()}>
                {[0, 1, 2, 3].map((_, idx) => {
                  // Generate vibrant colors with good contrast
                  const hue = (idx * 90 + Math.floor(Date.now() / 1000) * 30) % 360; // Rotate hues over time
                  const saturation = 80 + Math.floor(Math.random() * 20); // 80-100%
                  const lightness = 50 + Math.floor(Math.random() * 20); // 50-70%
                  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                  
                  // Different animation properties for each ring
                  const animationProps = [
                    { duration: '1.2s', direction: 'normal' },
                    { duration: '1.5s', direction: 'reverse' },
                    { duration: '1.8s', direction: 'normal' },
                    { duration: '2s', direction: 'reverse', ping: true }
                  ][idx];

                  return (
                    <div 
                      key={idx}
                      className={`absolute inset-${idx} rounded-full border-4 border-t-transparent ${
                        animationProps.ping ? 'animate-ping' : 'animate-spin'
                      }`}
                      style={{
                        borderColor: animationProps.ping ? 'rgba(255,255,255,0.3)' : color,
                        animationDuration: animationProps.duration,
                        animationDirection: animationProps.direction as any,
                        opacity: animationProps.ping ? 0.3 : 0.8
                      }}
                    />
                  );
                })}
              </div>
              <div 
                className={`text-xl font-medium text-center transition-opacity duration-500 ${
                  showQuote ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ textShadow: '0 0 10px rgba(255,255,255,0.8)' }}
              >
                {currentQuote}
              </div>
            </div>
            </React.Fragment>
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
