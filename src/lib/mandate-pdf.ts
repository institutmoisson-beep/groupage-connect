import { jsPDF } from "jspdf";

import { ofsMandateText } from "@/lib/onfaisimple";

export interface MandatePdfInput {
  reference: string;
  fullName: string;
  productTitle: string;
  units: number;
  total: number;
  payout: number;
  days: number;
  sharePercent: number;
  signedAt?: string;
  /** Téléphone / identifiant du mandant, imprimé dans le bloc signature. */
  phone?: string | null;
}

const NAVY: [number, number, number] = [15, 23, 42];
const GOLD: [number, number, number] = [245, 158, 11];
const EMERALD: [number, number, number] = [16, 185, 129];
const GREY: [number, number, number] = [110, 118, 132];

const M = 16; // marge
const W = 210;
const H = 297;
const CONTENT = W - M * 2;

/** Génère le contrat de mandat OnFaiSimple™ mis en page, avec mentions légales et signatures. */
export function buildMandatePdf(input: MandatePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const text = ofsMandateText(input);
  const lines = text.split("\n");

  let y = 0;
  let page = 1;

  const footer = () => {
    doc.setDrawColor(...GREY);
    doc.setLineWidth(0.2);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(
      "MSN COURTIER — OnFaiSimple\u2122, filiale de l'Institut Moisson · Abidjan, Côte d'Ivoire",
      M,
      H - 10,
    );
    doc.text(`Réf. ${input.reference} · page ${page}`, W - M, H - 10, { align: "right" });
  };

  const header = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 30, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 30, W, 1.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text("OnFaiSimple\u2122", M, 14);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GOLD);
    doc.text("MSN COURTIER · Sourcing participatif géré", M, 20);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text("CONTRAT DE MANDAT", W - M, 13, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(input.reference, W - M, 18.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    if (input.signedAt) doc.text(`Signé le ${input.signedAt}`, W - M, 23.5, { align: "right" });
    y = 40;
  };

  const newPage = () => {
    footer();
    doc.addPage();
    page += 1;
    header();
  };

  const need = (h: number) => {
    if (y + h > H - 20) newPage();
  };

  header();

  /* --- Bandeau récapitulatif --- */
  const recap: Array<[string, string]> = [
    ["Mandant", input.fullName || "Le Mandant"],
    ["Lot financé", input.productTitle],
    ["Unités", String(input.units)],
    ["Capital de financement", `${input.total.toLocaleString("fr-FR")} FCFA`],
    ["Versement attendu", `${input.payout.toLocaleString("fr-FR")} FCFA`],
    ["Part de marge Mandant", `${input.sharePercent}%`],
    ["Délai estimé du cycle", `${input.days} jours`],
  ];
  const boxH = recap.length * 6 + 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CONTENT, boxH, 2, 2, "FD");
  let ry = y + 7;
  recap.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(k, M + 4, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(String(v), W - M - 4, ry, { align: "right", maxWidth: CONTENT * 0.55 });
    ry += 6;
  });
  y += boxH + 8;

  /* --- Corps du contrat --- */
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      y += 2.5;
      continue;
    }
    if (line === "CONTRAT DE MANDAT DE VENTE COMMERCIALE") continue;
    if (/^Référence :/.test(line) || /^Signé le :/.test(line)) continue;

    const isArticle = /^Article \d+/.test(line);
    const isHeading = isArticle || /^Entre les soussignés/.test(line);
    const isSignature = /^Signature électronique/.test(line);

    if (isSignature) break;

    doc.setFont("helvetica", isHeading ? "bold" : "normal");
    doc.setFontSize(isHeading ? 9.5 : 8.5);
    const wrapped = doc.splitTextToSize(line, CONTENT) as string[];
    need(wrapped.length * (isHeading ? 5 : 4.4) + (isHeading ? 4 : 1));
    if (isHeading) y += 3;
    const body: [number, number, number] = [40, 44, 52];
    doc.setTextColor(...(isHeading ? NAVY : body));
    if (isArticle) {
      doc.setFillColor(...GOLD);
      doc.rect(M, y - 3.4, 1.4, 4, "F");
      doc.text(wrapped, M + 4, y);
    } else {
      doc.text(wrapped, M, y);
    }
    y += wrapped.length * (isHeading ? 5 : 4.4) + (isHeading ? 1.5 : 1);
  }

  /* --- Mentions légales --- */
  need(30);
  y += 6;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...GOLD);
  const mentions =
    "Mentions légales — Le présent contrat est conclu à distance par voie électronique. Le Mandant reconnaît " +
    "avoir pris connaissance des Conditions Générales d'Utilisation et de Vente de MSN COURTIER, qui font partie " +
    "intégrante du présent contrat. Le capital de financement bénéficie de la garantie de reversement de l'Article 3 ; " +
    "le profit reste soumis à l'aléa commercial de l'Article 8. Document généré automatiquement et archivé de manière " +
    "permanente ; il vaut preuve entre les parties au sens des usages du commerce électronique.";
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  const mw = doc.splitTextToSize(mentions, CONTENT - 8) as string[];
  const mh = mw.length * 3.6 + 7;
  need(mh + 4);
  doc.roundedRect(M, y, CONTENT, mh, 2, 2, "FD");
  doc.setTextColor(90, 70, 20);
  doc.text(mw, M + 4, y + 5);
  y += mh + 10;

  /* --- Signatures --- */
  need(46);
  const colW = (CONTENT - 8) / 2;
  const sigY = y;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, sigY, colW, 40, 2, 2, "S");
  doc.roundedRect(M + colW + 8, sigY, colW, 40, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("LE MANDANT", M + 4, sigY + 6);
  doc.text("LE MANDATAIRE", M + colW + 12, sigY + 6);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(input.fullName || "Le Mandant", M + 4, sigY + 19);
  doc.setTextColor(...GOLD);
  doc.text("MSN Courtier", M + colW + 12, sigY + 19);

  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.2);
  doc.line(M + 4, sigY + 22, M + colW - 4, sigY + 22);
  doc.line(M + colW + 12, sigY + 22, M + CONTENT - 4, sigY + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text(
    doc.splitTextToSize(
      `Signature électronique validée par code PIN à 4 chiffres${input.phone ? ` · ${input.phone}` : ""}${
        input.signedAt ? `\nLe ${input.signedAt}` : ""
      }`,
      colW - 8,
    ) as string[],
    M + 4,
    sigY + 27,
  );
  doc.text(
    doc.splitTextToSize(
      "Pour MSN COURTIER, opérateur OnFaiSimple\u2122\nFiliale de l'Institut Moisson · Abidjan",
      colW - 8,
    ) as string[],
    M + colW + 12,
    sigY + 27,
  );

  doc.setTextColor(...EMERALD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("\u2713 Contrat signé et archivé", M + 4, sigY + 37);

  footer();
  return doc;
}

export function downloadMandatePdf(input: MandatePdfInput) {
  buildMandatePdf(input).save(`Contrat-${input.reference}.pdf`);
}
