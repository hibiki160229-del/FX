/**
 * Next.js instrumentation — start the always-on analysis worker on Node boot.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startAnalysisScheduler } = await import("@/lib/analysis/scheduler");
  startAnalysisScheduler();
}