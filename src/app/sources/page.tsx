import type { Metadata } from "next";

import MaterialsPage from "@/app/materials/page";

export const metadata: Metadata = {
  title: "Sources | StudySourced AI",
  description: "Keep private course sources organized and ready for cited study tools.",
};

export const runtime = "nodejs";
export const maxDuration = 60;

export default MaterialsPage;
