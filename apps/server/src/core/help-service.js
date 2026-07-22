import { getLocalizedHelpMessage } from '../i18n/messages.js';

export function getHelpMessage(language = 'en') {
  return getLocalizedHelpMessage(language);
}
