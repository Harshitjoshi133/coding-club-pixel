import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  runTransaction,
} from "firebase/firestore";
// import { isAnonymous } from "firebase/auth";

export async function POST(req: NextRequest) {
  try {
    const { x, y, color, userId } = await req.json();

    if (typeof x !== "number" || typeof y !== "number" || !color || !userId) {
      return NextResponse.json(
        { error: "Invalid input data." },
        { status: 400 }
      );
    }

    const userDocRef = doc(db, "users", userId);
    const pixelDocRef = doc(db, "pixels", `${x}-${y}`);

    await runTransaction(db, async (transaction) => {
      const userDocSnap = await transaction.get(userDocRef);
      const pixelDocSnap = await transaction.get(pixelDocRef);

      // Rule 1: User can only place one pixel
      if (userDocSnap.exists() && userDocSnap.data().hasPlaced) {
        throw new Error("You have already placed a pixel.");
      }

      // Rule 2: Pixel can only be placed once
      if (pixelDocSnap.exists()) {
        throw new Error("This pixel is already placed.");
      }

      // Write the pixel data
      transaction.set(pixelDocRef, {
        x,
        y,
        color,
        placedBy: userId,
        timestamp: new Date(),
      });

      // Update the user's status
      transaction.set(
        userDocRef,
        {
          hasPlaced: true,
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.log(error);
    return NextResponse.json(
      { error: error.message || "An unknown error occurred." },
      { status: 500 }
    );
  }
}
