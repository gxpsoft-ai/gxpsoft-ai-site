/**
 * Email validation utilities for GxPSoft AI.
 * Enforces business / corporate email addresses and blocks public consumer email providers.
 */

export const PUBLIC_EMAIL_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',

  // Microsoft
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.es',
  'hotmail.it',
  'hotmail.ca',
  'outlook.com',
  'outlook.co.uk',
  'outlook.fr',
  'outlook.de',
  'outlook.es',
  'outlook.jp',
  'outlook.kr',
  'live.com',
  'live.co.uk',
  'live.fr',
  'live.de',
  'live.ca',
  'msn.com',
  'windowslive.com',
  'passport.com',

  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.co.jp',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.es',
  'yahoo.it',
  'yahoo.com.br',
  'yahoo.com.au',
  'yahoo.co.in',
  'ymail.com',
  'rocketmail.com',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // AOL
  'aol.com',
  'aim.com',

  // Korean Consumer Portals
  'naver.com',
  'daum.net',
  'hanmail.net',
  'kakao.com',
  'nate.com',
  'paran.com',
  'dreamwiz.com',
  'chol.com',

  // Russian Consumer Services
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',
  'rambler.ru',

  // European Consumer Services
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'gmx.at',
  'gmx.ch',
  'web.de',
  't-online.de',
  'freenet.de',
  'libero.it',
  'virgilio.it',
  'alice.it',
  'tim.it',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
  'seznam.cz',
  'wp.pl',
  'onet.pl',
  'interia.pl',
  'o2.pl',

  // Chinese Consumer Services
  '163.com',
  '126.com',
  'yeah.net',
  'qq.com',
  'vip.qq.com',
  'foxmail.com',
  'sina.com',
  'sina.cn',
  'sohu.com',
  '139.com',

  // US & International ISPs
  'comcast.net',
  'verizon.net',
  'att.net',
  'sbcglobal.net',
  'bellsouth.net',
  'cox.net',
  'charter.net',
  'earthlink.net',
  'optonline.net',
  'frontier.com',
  'windstream.net',
  'centurylink.net',
  'shaw.ca',
  'sympatico.ca',
  'rogers.com',
  'bell.net',
  'telus.net',
  'btinternet.com',
  'virginmedia.com',
  'blueyonder.co.uk',
  'sky.com',
  'talktalk.net',
  'bigpond.com',
  'optusnet.com.au',
  'xtra.co.nz',

  // Privacy / Consumer Free Mail
  'proton.me',
  'protonmail.com',
  'pm.me',
  'tutanota.com',
  'tuta.io',
  'skiff.com',
  'zoho.com',
  'zohomail.com',
  'mail.com',
  'inbox.com',
  'fastmail.com',
  'hushmail.com',
  'rediffmail.com',

  // Common Disposable / Burner Domains
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  'sharklasers.com',
  '10minutemail.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
  'getairmail.com',
  'fakemailgenerator.com',
  'burnermail.io',
  'temp-mail.org',
  'mohmal.com',
  'crazymailing.com',
  'nada.ltd',
  'generator.email'
]);

const DISPOSABLE_KEYWORDS = [
  'tempmail',
  'disposable',
  'guerrillamail',
  'mailinator',
  'throwaway',
  'trashmail',
  'yopmail',
  '10minute',
  'fakeinbox',
  'burner',
  'sharklasers'
];

/**
 * Validates whether an email is a legitimate business email.
 * Rejects public domains (Gmail, Hotmail, etc.) and disposable emails.
 */
export function validateBusinessEmail(emailStr: string, locale: 'en' | 'ko' = 'en'): {
  isValid: boolean;
  error?: string;
  domain?: string;
} {
  if (!emailStr || typeof emailStr !== 'string') {
    return {
      isValid: false,
      error: locale === 'ko' ? '이메일 주소를 입력해 주세요.' : 'Please enter an email address.'
    };
  }

  const trimmed = emailStr.trim().toLowerCase();

  // Basic RFC5322-compatible pattern check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error: locale === 'ko' ? '올바른 이메일 형식이 아닙니다.' : 'Invalid email format.'
    };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: locale === 'ko' ? '올바른 이메일 형식이 아닙니다.' : 'Invalid email format.'
    };
  }

  const domain = parts[1];

  // Disallow direct IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(domain) || domain.startsWith('[') || domain.endsWith(']')) {
    return {
      isValid: false,
      error: locale === 'ko' ? '기업 도메인 이메일을 입력해 주세요.' : 'Please provide a valid corporate domain email.'
    };
  }

  // Check against known public email domains
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      domain,
      error: locale === 'ko'
        ? `공용 이메일 계정(@${domain})은 접수되지 않습니다. 회사/업무용 기업 이메일을 입력해 주세요.`
        : `Public email accounts (@${domain}) are not accepted. Please use your corporate or organization email address.`
    };
  }

  // Check for disposable keyword patterns
  for (const keyword of DISPOSABLE_KEYWORDS) {
    if (domain.includes(keyword)) {
      return {
        isValid: false,
        domain,
        error: locale === 'ko'
          ? '일회용 또는 임시 이메일 주소는 허용되지 않습니다.'
          : 'Disposable or temporary email addresses are not allowed.'
      };
    }
  }

  return { isValid: true, domain };
}
