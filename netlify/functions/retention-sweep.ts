import type { Config } from "@netlify/functions";
import { sweep } from "../../src/lib/retention";

// Replaces the setInterval-based sweep that traditional Node hosting uses:
// Netlify has no long-lived process to run a timer in, so a Scheduled
// Function calls the same sweep() logic once a minute instead — the same
// cadence the local setInterval used. Files still get deleted 15 min after
// printing or 2 h after upload, whichever is first.
export default async () => {
  await sweep();
};

export const config: Config = {
  schedule: "* * * * *",
};
