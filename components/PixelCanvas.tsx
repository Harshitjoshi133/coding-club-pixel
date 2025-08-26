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

const GRID_SIZE = 64;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const REVEAL_THRESHOLD = 300;

export default function PixelCanvas() {
  const [pixels, setPixels] = useState<Record<string, Pixel>>({});
  const [placedPixel, setPlacedPixel] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [totalPlaced, setTotalPlaced] = useState(0);
  const [audienceCount, setAudienceCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const { user, loading: authLoading } = useAuthAnonymously();

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
    <main className="flex flex-col items-center justify-center p-8 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold mb-4 text-center">Pixel Canvas Club</h1>
      <p className="text-lg text-gray-600 mb-6 text-center">
        Place your one pixel to help reveal the hidden logo!
      </p>
      
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

      <div className="relative w-full max-w-2xl aspect-square border-4 border-black shadow-lg bg-gray-300">
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
        <div
          className={cn(
            "grid w-full h-full relative z-20",
            isRevealed && "opacity-0 transition-opacity duration-1000"
          )}
          style={canvasStyle}
        >
          {[...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => {
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
              />
            );
          })}
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
