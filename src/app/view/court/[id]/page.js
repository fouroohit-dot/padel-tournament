import { Suspense } from "react";
import CourtViewClient from "src/app/view/court/CourtViewClient.js";

export default function CourtViewPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: "#446463",
            color: "#e4e2db",
            padding: 24,
          }}
        >
          Loading court...
        </main>
      }
    >
      <CourtViewClient />
    </Suspense>
  );
}
