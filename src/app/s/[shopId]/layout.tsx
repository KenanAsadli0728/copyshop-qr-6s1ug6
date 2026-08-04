import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { shopId: string };
}): Promise<Metadata> {
  return {
    manifest: `/s/${params.shopId}/manifest.webmanifest`,
    themeColor: "#5B4FE9",
  };
}

export default function ShopKioskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
