import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();

function createSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Add this function to update existing kids with slugs
export const updateKidSlugs = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const kidsSnapshot = await db.collection("kids").get();
  const batch = db.batch();

  kidsSnapshot.docs.forEach((doc) => {
    const kidData = doc.data();
    if (!kidData.slug) {
      batch.update(doc.ref, {
        slug: createSlug(kidData.name),
      });
    }
  });

  await batch.commit();
  res.json({ message: "Slugs updated successfully" });
});

interface ProcessedAllowance {
  name: string;
  amount: number;
}

export const dailyAllowance = functions.pubsub
  .schedule("0 0 * * *")
  .onRun(async (_context: functions.EventContext) => {
    const db = admin.firestore();
    const today = new Date();
    const dayOfWeek = today.toLocaleString("en-US", { weekday: "long" });

    console.log(`[${new Date().toISOString()}] Running allowance check for ${dayOfWeek}`);

    try {
      // Get all kids who should receive allowance today
      const kidsSnapshot = await db.collection("kids")
        .where("allowanceDay", "==", dayOfWeek)
        .where("weeklyAllowance", ">", 0)
        .get();

      console.log(`Found ${kidsSnapshot.size} kids with allowance day set to ${dayOfWeek}`);

      if (kidsSnapshot.empty) {
        console.log(`No allowances to process for ${dayOfWeek}`);
        return null;
      }

      const batch = db.batch();
      let processedCount = 0;

      kidsSnapshot.forEach((kidDoc) => {
        const kidData = kidDoc.data();
        const kidRef = db.collection("kids").doc(kidDoc.id);

        console.log(`Processing allowance for ${kidData.name}:
          Amount: $${kidData.weeklyAllowance}
          Day: ${kidData.allowanceDay}
          Current Balance: $${kidData.total}
        `);

        // Update total
        batch.update(kidRef, {
          total: admin.firestore.FieldValue.increment(kidData.weeklyAllowance),
        });

        // Add transaction
        const transactionRef = kidRef.collection("transactions").doc();
        batch.set(transactionRef, {
          amount: kidData.weeklyAllowance,
          description: `Weekly Allowance (${dayOfWeek})`,
          date: admin.firestore.FieldValue.serverTimestamp(),
        });

        processedCount++;
      });

      await batch.commit();
      console.log(`Successfully processed allowances for ${processedCount} kids on ${dayOfWeek}`);
      return null;
    } catch (error) {
      console.error("Error processing allowances:", error);
      return null;
    }
  });

// Test function
export const testAllowance = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const today = new Date();
  const dayOfWeek = today.toLocaleString("en-US", { weekday: "long" });

  console.log(`Testing allowance for ${dayOfWeek}`);

  const kidsSnapshot = await db.collection("kids")
    .where("allowanceDay", "==", dayOfWeek)
    .where("weeklyAllowance", ">", 0)
    .get();

  if (kidsSnapshot.empty) {
    console.log(`No allowances to process for ${dayOfWeek}`);
    res.json({ message: "No allowances to process", day: dayOfWeek });
    return;
  }

  const batch = db.batch();
  const processed: ProcessedAllowance[] = [];

  kidsSnapshot.forEach((kidDoc) => {
    const kidData = kidDoc.data();
    const kidRef = db.collection("kids").doc(kidDoc.id);

    batch.update(kidRef, {
      total: admin.firestore.FieldValue.increment(kidData.weeklyAllowance),
    });

    const transactionRef = kidRef.collection("transactions").doc();
    batch.set(transactionRef, {
      amount: kidData.weeklyAllowance,
      description: `Weekly Allowance (${dayOfWeek}) - Test`,
      date: admin.firestore.FieldValue.serverTimestamp(),
    });

    processed.push({
      name: kidData.name,
      amount: kidData.weeklyAllowance,
    });
  });

  await batch.commit();

  res.json({
    message: "Test allowance processed successfully",
    day: dayOfWeek,
    processed,
  });
});

// Add a trigger to automatically create slugs for new kids
export const onKidCreated = functions.firestore
  .document("kids/{kidId}")
  .onCreate(async (snap, _context) => {
    const db = admin.firestore();
    const kidData = snap.data();

    const updates: { [key: string]: any } = {
      public: false, // Default to private
    };

    if (!kidData.slug) {
      updates.slug = await generateUniqueSlug(db, kidData.name);
    }

    if (Object.keys(updates).length > 0) {
      await snap.ref.update(updates);
    }
  });

// Add this function to check if a slug exists
async function checkSlugExists(db: admin.firestore.Firestore, slug: string): Promise<boolean> {
  const snapshot = await db.collection("kids").where("slug", "==", slug).get();
  return !snapshot.empty;
}

// Modify this function to generate a unique slug
async function generateUniqueSlug(db: admin.firestore.Firestore, name: string): Promise<string> {
  let slug = createSlug(name);
  let counter = 1;

  while (await checkSlugExists(db, slug)) {
    slug = `${createSlug(name)}-${counter}`;
    counter++;
  }

  return slug;
}

// Add this migration function
export const migrateKids = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
  const batch = db.batch();
  const kidsSnapshot = await db.collection("kids").get();
  let migratedCount = 0;

  kidsSnapshot.docs.forEach((doc) => {
    const kidData = doc.data();
    const updates: { [key: string]: any } = {};

    // Ensure slug exists
    if (!kidData.slug) {
      updates.slug = createSlug(kidData.name);
    }

    // Ensure sharedWith is an array
    if (!kidData.sharedWith || !Array.isArray(kidData.sharedWith)) {
      updates.sharedWith = [];
    }

    // Ensure public field exists
    if (typeof kidData.public === "undefined") {
      updates.public = false;
    }

    // Ensure total is a number
    if (typeof kidData.total !== "number") {
      updates.total = 0;
    }

    // Ensure weeklyAllowance is a number
    if (typeof kidData.weeklyAllowance !== "number") {
      updates.weeklyAllowance = 0;
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      migratedCount++;
    }
  });

  if (migratedCount > 0) {
    await batch.commit();
  }

  res.json({
    message: `Migration complete. Updated ${migratedCount} kids.`,
    migratedCount,
  });
});

