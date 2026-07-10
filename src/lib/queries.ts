import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_urls: string[];
  cny_price: number;
  logistics_fee_xof: number;
  exchange_rate_cny_xof: number;
  active: boolean;
};

export type Campaign = {
  id: string;
  title: string;
  description: string | null;
  shipping_type: "sea" | "air";
  target_quantity: number;
  current_participants: number;
  end_date: string;
  status: "open" | "closed" | "shipped" | "arrived";
  eta_days: number;
  container_image: string | null;
};

export type CampaignProduct = { campaign_id: string; product_id: string };

export const productsQuery = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
  });

export const campaignsQuery = () =>
  queryOptions({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groupage_campaigns")
        .select("*")
        .order("end_date", { ascending: true });
      if (error) throw error;
      return data as Campaign[];
    },
  });

export const campaignProductsQuery = () =>
  queryOptions({
    queryKey: ["campaign_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_products").select("*");
      if (error) throw error;
      return data as CampaignProduct[];
    },
  });

export const activeCampaignForProduct = (
  campaignProducts: CampaignProduct[],
  campaigns: Campaign[],
  productId: string,
): Campaign | undefined => {
  const links = campaignProducts.filter((cp) => cp.product_id === productId);
  const active = campaigns.filter(
    (c) => c.status === "open" && links.some((l) => l.campaign_id === c.id),
  );
  return active.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())[0];
};
