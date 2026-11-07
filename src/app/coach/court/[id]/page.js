
import { Suspense } from "react";
import RefereeCourtClient from "./RefereeCourtClient";

export default function RefereeCourtPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: "#446463",
            color: "#e4e2db",
            padding: 24,
            fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
          }}
        >
          Loading referee screen...
        </main>
      }
    >
      <RefereeCourtClient />
    </Suspense>
  );
}
