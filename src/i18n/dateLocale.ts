import { Locale } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { es } from "date-fns/locale/es";
import { enUS } from "date-fns/locale/en-US";
import i18n from "@/i18n";

const locales: Record<string, Locale> = { fr, en: enUS, es };

export function getDateLocale(): Locale {
  return locales[i18n.language] || fr;
}
