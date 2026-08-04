import { redirect } from "next/navigation";

// The code-entry screen now lives at the site root ("/"); this just keeps the
// old /s link working for anyone who bookmarked it.
export default function ShopEntryRedirect() {
  redirect("/");
}
