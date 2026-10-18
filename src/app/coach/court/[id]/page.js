
import { Suspense } from "react";
import CourtScoringClient from "./CourtScoringClient";

export default function CourtScoringPage({ params }) {
  return (
    <Suspense
      fallback={
        <main className="loading-screen">
          <h1>Loading Court...</h1>
          <p>Connecting to the tournament scoring system.</p>
        </main>
      }
    >
      <CourtScoringClient params={params} />
    </Suspense>
  );
}
