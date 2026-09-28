import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { EmailMessage } from 'cloudflare:email';
import { validateBusinessEmail } from '../../utils/emailValidation';

export const prerender = false;

// Helpers
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildMimeMessage({
  from,
  to,
  replyTo,
  subject,
  text,
  html,
}: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  // Base64 encode UTF-8 subject for RFC 2047 compatibility
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

  const headers = [
    `From: GxPSoft AI <${from}>`,
    `To: <${to}>`,
    replyTo ? `Reply-To: <${replyTo}>` : '',
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join('\r\n');

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(text))),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(html))),
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  return `${headers}\r\n\r\n${body}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();
  const cf = (request as any).cf;
  const ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';
  const country = cf?.country || 'Unknown';
  const city = cf?.city || 'Unknown';
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  // Access Cloudflare environment bindings
  const workerEnv: any = env || (locals as any)?.runtime?.env || {};
  const kvSession = workerEnv.SESSION;
  const emailBinding = workerEnv.EMAIL;

  // 1. Origin & Referer Verification (CSRF Protection)
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const allowedHosts = ['gxpsoft.ai', 'www.gxpsoft.ai', 'localhost', '127.0.0.1'];
      const isAllowed =
        allowedHosts.includes(originUrl.hostname) ||
        originUrl.hostname.endsWith('.workers.dev') ||
        originUrl.hostname.endsWith('.pages.dev');

      if (!isAllowed) {
        return new Response(JSON.stringify({ error: 'Forbidden: Invalid request origin.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid origin header.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. Cloudflare Bot Score Check (if available on Enterprise or Bot Management plans)
  if (cf?.botManagement?.score !== undefined && cf.botManagement.score < 20) {
    console.warn(`[AntiSpam] Blocked low bot management score (${cf.botManagement.score}) from IP: ${ip}`);
    return new Response(
      JSON.stringify({ error: 'Automated requests are blocked by security policy.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Cloudflare KV Rate Limiting (5 submissions per 10 minutes per IP in production)
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  const maxSubmissions = isLocalhost ? 50 : 5;

  if (kvSession && typeof kvSession.get === 'function' && typeof kvSession.put === 'function') {
    try {
      const rateLimitKey = `rate_limit:inquiry:${ip}`;
      const countStr = await kvSession.get(rateLimitKey);
      const count = countStr ? parseInt(countStr, 10) : 0;

      if (count >= maxSubmissions) {
        console.warn(`[RateLimit] IP ${ip} exceeded submission threshold (${count}/${maxSubmissions}).`);
        return new Response(
          JSON.stringify({
            error: 'Too many inquiry submissions from this IP address. Please wait a few minutes before trying again.',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await kvSession.put(rateLimitKey, String(count + 1), { expirationTtl: 600 });
    } catch (kvErr) {
      console.error('[RateLimit] Cloudflare KV check error:', kvErr);
      // Proceed without failing the request if KV has transient error
    }
  }

  // Parse Form Data or JSON
  let body: Record<string, string> = {};
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        if (typeof value === 'string') {
          body[key] = value;
        }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported Content-Type.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to parse request payload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const locale = (body.locale === 'ko' ? 'ko' : 'en') as 'en' | 'ko';

  // 4. Honeypot Spam Traps
  // Hidden fields intended solely for spambots. If populated, silently succeed to mislead the bot.
  if (body._hp_company_url || body._hp_fax || body._hp_title) {
    console.warn(`[AntiSpam] Honeypot triggered by IP ${ip}. Fields:`, {
      url: body._hp_company_url,
      fax: body._hp_fax,
      title: body._hp_title,
    });
    return new Response(
      JSON.stringify({
        success: true,
        message:
          locale === 'ko'
            ? '문의가 접수되었습니다. 담당자가 곧 연락드리겠습니다.'
            : 'Thank you for your inquiry. Our team will get back to you shortly.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. Time-to-Submit Verification (Catch rapid automated bot submissions)
  if (body._form_ts) {
    const formTs = parseInt(body._form_ts, 10);
    if (!isNaN(formTs)) {
      const elapsed = startTime - formTs;
      if (elapsed < 2000) {
        console.warn(`[AntiSpam] Submission was unnaturally fast (${elapsed}ms) from IP ${ip}`);
        return new Response(
          JSON.stringify({
            error:
              locale === 'ko'
                ? '너무 빠른 제출이 감지되었습니다. 잠시 후 다시 시도해 주세요.'
                : 'Form submission completed too quickly. Please review your input and try again.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (elapsed > 24 * 60 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            error:
              locale === 'ko'
                ? '양식 유효 시간이 만료되었습니다. 페이지를 새로고침 후 다시 작성해 주세요.'
                : 'Form session has expired. Please refresh the page and try again.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // 6. Cloudflare Turnstile Verification
  const turnstileToken = body['cf-turnstile-response'] || body.turnstileToken;
  const turnstileSecretKey = workerEnv.TURNSTILE_SECRET_KEY;

  if (turnstileSecretKey) {
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({
          error:
            locale === 'ko'
              ? '보안 인증(Cloudflare Turnstile)을 완료해 주세요.'
              : 'Please complete the Cloudflare security verification.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const verifyFormData = new FormData();
      verifyFormData.append('secret', turnstileSecretKey);
      verifyFormData.append('response', turnstileToken);
      verifyFormData.append('remoteip', ip);

      const turnstileRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: verifyFormData,
        }
      );

      const turnstileData: any = await turnstileRes.json();
      if (!turnstileData.success) {
        console.warn(`[Turnstile] Verification failed for IP ${ip}:`, turnstileData['error-codes']);
        return new Response(
          JSON.stringify({
            error:
              locale === 'ko'
                ? '보안 인증에 실패하였습니다. 다시 시도해 주세요.'
                : 'Security verification failed. Please try again.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (turnstileErr) {
      console.error('[Turnstile] Error verifying token:', turnstileErr);
      return new Response(
        JSON.stringify({
          error:
            locale === 'ko'
              ? '보안 인증 서버 연결 중 오류가 발생했습니다.'
              : 'Failed to verify security token with Cloudflare.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 7. Input Sanitization & Strict Validation
  const name = (body.name || '').trim();
  const company = (body.company || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const inquiryType = (body.inquiryType || body.subject || 'General Inquiry').trim();
  const message = (body.message || '').trim();
  const phone = (body.phone || '').trim();

  if (!name || name.length < 2 || name.length > 100) {
    return new Response(
      JSON.stringify({
        error:
          locale === 'ko'
            ? '성함 또는 담당자명을 2자 이상 100자 이하로 입력해 주세요.'
            : 'Please enter a valid contact name (2-100 characters).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!company || company.length < 2 || company.length > 100) {
    return new Response(
      JSON.stringify({
        error:
          locale === 'ko'
            ? '회사명 또는 소속 기관명을 입력해 주세요.'
            : 'Please enter your company or organization name (2-100 characters).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Business Email Validation: Block public domains (Gmail, Hotmail, Yahoo, Naver, etc.)
  const emailValidation = validateBusinessEmail(email, locale);
  if (!emailValidation.isValid) {
    return new Response(
      JSON.stringify({
        error: emailValidation.error,
        field: 'email',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!message || message.length < 10 || message.length > 4000) {
    return new Response(
      JSON.stringify({
        error:
          locale === 'ko'
            ? '문의 내용을 10자 이상 4,000자 이하로 입력해 주세요.'
            : 'Please enter your message (between 10 and 4,000 characters).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 8. Content Spam Heuristics
  // Check for excessive URL dumping (common in link spam)
  const urlMatches = message.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > 3) {
    console.warn(`[AntiSpam] Excessive URLs (${urlMatches.length}) in message from IP ${ip}`);
    return new Response(
      JSON.stringify({
        error:
          locale === 'ko'
            ? '스팸 방지를 위해 메시지 내 URL 링크는 최대 3개까지만 포함할 수 있습니다.'
            : 'To prevent spam, messages cannot contain more than 3 URLs.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check for common exploit / spam keywords
  const spamKeywordsRegex = /(viagra|cialis|crypto\s*airdrop|casino|free\s*bitcoin|escort\s*service)/i;
  if (spamKeywordsRegex.test(message) || spamKeywordsRegex.test(company)) {
    console.warn(`[AntiSpam] Flagged spam keyword match from IP ${ip}`);
    return new Response(
      JSON.stringify({
        error:
          locale === 'ko'
            ? '허용되지 않는 스팸성 키워드가 포함되어 있습니다.'
            : 'Message content flagged by automated abuse filter.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 9. Send Email via Cloudflare Email Service (Send Email Binding)
  const recipientEmail =
    workerEnv.INQUIRY_RECIPIENT_EMAIL || workerEnv.CONTACT_EMAIL || 'info@saram.consulting';
  const fromEmail = workerEnv.EMAIL_FROM || 'no-reply@gxpsoft.ai';
  const emailSubject = `[GxPSoft Inquiry] ${inquiryType} - ${company} (${name})`;

  const textBody = [
    `New Corporate Inquiry Received`,
    `=============================`,
    ``,
    `Name:         ${name}`,
    `Company:      ${company}`,
    `Email:        ${email}`,
    phone ? `Phone:        ${phone}` : '',
    `Inquiry Type: ${inquiryType}`,
    `Locale:       ${locale.toUpperCase()}`,
    ``,
    `Message:`,
    `-----------------------------`,
    message,
    `-----------------------------`,
    ``,
    `Security & Network Metadata:`,
    `IP Address:   ${ip}`,
    `Country/City: ${country} / ${city}`,
    `User Agent:   ${userAgent}`,
    `Received At:  ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #18181b; background-color: #f4f4f5; padding: 24px; margin: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden; }
    .header { background: #09090b; color: #fafafa; padding: 20px 24px; }
    .header h2 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.05em; }
    .header p { margin: 4px 0 0 0; color: #a1a1aa; font-size: 13px; }
    .content { padding: 24px; }
    .field-row { margin-bottom: 14px; border-bottom: 1px solid #f4f4f5; padding-bottom: 8px; }
    .field-label { font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 2px; }
    .field-value { font-size: 14px; color: #09090b; font-weight: 500; }
    .message-box { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px; margin-top: 16px; white-space: pre-wrap; font-size: 14px; }
    .meta-footer { background: #fafafa; border-top: 1px solid #e4e4e7; padding: 16px 24px; font-size: 12px; color: #71717a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>GxPSoft AI - New Corporate Inquiry</h2>
      <p>Received via gxpsoft.ai server-side inquiry endpoint</p>
    </div>
    <div class="content">
      <div class="field-row">
        <div class="field-label">Contact Name</div>
        <div class="field-value">${escapeHtml(name)}</div>
      </div>
      <div class="field-row">
        <div class="field-label">Company / Organization</div>
        <div class="field-value">${escapeHtml(company)}</div>
      </div>
      <div class="field-row">
        <div class="field-label">Business Email</div>
        <div class="field-value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
      </div>
      ${
        phone
          ? `<div class="field-row">
        <div class="field-label">Phone Number</div>
        <div class="field-value">${escapeHtml(phone)}</div>
      </div>`
          : ''
      }
      <div class="field-row">
        <div class="field-label">Inquiry Topic</div>
        <div class="field-value">${escapeHtml(inquiryType)}</div>
      </div>
      <div class="field-label" style="margin-top: 20px;">Inquiry Details</div>
      <div class="message-box">${escapeHtml(message)}</div>
    </div>
    <div class="meta-footer">
      <div><strong>Security Metadata:</strong> IP: ${escapeHtml(ip)} | Location: ${escapeHtml(country)}, ${escapeHtml(city)}</div>
      <div><strong>Submitted:</strong> ${new Date().toISOString()} (Locale: ${locale.toUpperCase()})</div>
    </div>
  </div>
</body>
</html>
`;

  if (emailBinding && typeof emailBinding.send === 'function') {
    try {
      // 1st attempt: Structured EmailMessageBuilder (Modern Cloudflare Workers format)
      await emailBinding.send({
        to: [{ email: recipientEmail, name: 'GxPSoft AI Team' }],
        from: { email: fromEmail, name: 'GxPSoft AI Website' },
        replyTo: { email: email, name: name },
        subject: emailSubject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`[Cloudflare Email] Successfully dispatched inquiry from ${email} to ${recipientEmail}`);
    } catch (structuredErr: any) {
      console.warn('[Cloudflare Email] Structured send failed, attempting raw EmailMessage fallback:', structuredErr?.message);
      try {
        const rawMime = buildMimeMessage({
          from: fromEmail,
          to: recipientEmail,
          replyTo: email,
          subject: emailSubject,
          text: textBody,
          html: htmlBody,
        });
        const msg = new EmailMessage(fromEmail, recipientEmail, rawMime);
        await emailBinding.send(msg);
        console.log(`[Cloudflare Email] Successfully sent via EmailMessage fallback`);
      } catch (mimeErr: any) {
        console.error('[Cloudflare Email] Fatal: All Cloudflare email sending methods failed:', mimeErr);
        return new Response(
          JSON.stringify({
            error:
              locale === 'ko'
                ? '이메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주시거나 info@saram.consulting 으로 직접 문의해 주세요.'
                : 'Failed to dispatch email via Cloudflare Email Service. Please try again or email info@saram.consulting directly.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } else {
    // Development / Local mock fallback when running outside deployed Cloudflare Worker environment
    console.info(
      `[Dev Mode] Cloudflare send_email binding not present in local environment. Simulated dispatch:`
    );
    console.info({
      from: fromEmail,
      to: recipientEmail,
      replyTo: email,
      subject: emailSubject,
      text: textBody,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message:
        locale === 'ko'
          ? '문의가 성공적으로 전달되었습니다. 영업일 기준 1~2일 내로 회신드리겠습니다.'
          : 'Thank you for contacting GxPSoft AI. Your inquiry has been received, and our team will get back to you shortly.',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};
