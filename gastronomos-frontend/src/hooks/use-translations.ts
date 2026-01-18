'use client';

import { useLanguage } from '@/contexts/language-context';
import enMessages from '@/i18n/messages/en.json';
import ptBRMessages from '@/i18n/messages/pt-BR.json';

type Messages = typeof enMessages;
type MessageKey = keyof Messages;
type NestedMessageKey<T> = T extends object 
  ? { [K in keyof T]: K extends string 
      ? T[K] extends object 
        ? `${K}.${NestedMessageKey<T[K]>}` 
        : K 
      : never 
    }[keyof T]
  : never;

type TranslationKey = NestedMessageKey<Messages>;

const messages = {
  'en': enMessages,
  'pt-BR': ptBRMessages,
};

export function useTranslations() {
  const { language } = useLanguage();

  const t = (key: TranslationKey): string => {
    const keys = key.split('.');
    let value: any = messages[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = messages['en'];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found in fallback
          }
        }
        break;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return { t, language };
}