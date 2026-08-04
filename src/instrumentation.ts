export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRetention } = await import("./lib/retention");
    startRetention();
  }
}
