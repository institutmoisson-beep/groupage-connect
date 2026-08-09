import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Loader2, PackageCheck, Wallet } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXOF } from "@/lib/format";
import { playNotificationSound } from "@/lib/notification-sound";
import {
  OFS_PAYMENT_STATUS_LABELS,
  OFS_STAGES,
  OFS_STAGE_HINTS,
  OFS_STAGE_LABELS,
  type OfsStage,
} from "@/lib/onfaisimple";

export const Route = createFileRoute("/onfaisimple/orders")({
  head: () => ({
    meta: [
      { title: "Mes mandats OnFaiSimple™ — suivi en 7 étapes | MSN Courtier" },
      {
        name: "description",
        content:
          "Suivez chaque lot financé : achat en Chine, entrepôt, transit, dédouanement, mise en vente et clôture du gain.",
      },
      { property: "og:title", content: "Mes mandats OnFaiSimple™" },
      {
        property: "og:description",
        content: "Traçabilité en temps réel de vos lots financés et de vos gains crédités.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnFaiSimpleOrders;
});

function OnFaiSimpleOrders() {
  return null;
}
