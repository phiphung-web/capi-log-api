const DEFAULT_NOTIFY_EVENT_PATTERNS = [/otp/i];

function getTelegramConfig(env = process.env) {
  return {
    botToken: env.TELEGRAM_BOT_TOKEN || env.TELE_BOT_TOKEN || '',
    chatId: env.TELEGRAM_CHAT_ID || env.TELE_CHAT_ID || '',
    notifyEvents: env.TELEGRAM_NOTIFY_EVENTS || env.TELE_NOTIFY_EVENTS || '',
  };
}

function isConfigured(config = getTelegramConfig()) {
  return Boolean(config.botToken && config.chatId);
}

function getNestedValue(source, path) {
  return path.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') return null;
    return current[key] === undefined ? null : current[key];
  }, source);
}

function firstValue(source, paths) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

function parseNotifyEvents(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldNotifyTelegram(sourceBody, config = getTelegramConfig()) {
  const eventName = String(sourceBody?.event_name || '');
  const configuredEvents = parseNotifyEvents(config.notifyEvents);

  if (configuredEvents.length > 0) {
    return configuredEvents.some((event) => event.toLowerCase() === eventName.toLowerCase());
  }

  if (DEFAULT_NOTIFY_EVENT_PATTERNS.some((pattern) => pattern.test(eventName))) {
    return true;
  }

  const message = firstValue(sourceBody, ['otp_message', 'message', 'sms_message', 'content', 'text']);
  const code = firstValue(sourceBody, ['otp', 'otp_code', 'code', 'verification_code', 'metadata.otp', 'metadata.otp_code']);

  return Boolean(code || (typeof message === 'string' && /\botp\b|ma\s*otp|mã\s*otp/i.test(message)));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function compactLine(label, value) {
  if (value === undefined || value === null || value === '') return null;
  return `<b>${label}:</b> ${escapeHtml(value)}`;
}

function buildTelegramMessage(sourceBody, savedLog) {
  const code = firstValue(sourceBody, ['otp', 'otp_code', 'code', 'verification_code', 'metadata.otp', 'metadata.otp_code']);
  const message = firstValue(sourceBody, ['otp_message', 'message', 'sms_message', 'content', 'text', 'metadata.message']);
  const phone = firstValue(sourceBody, ['phone', 'phone_number', 'msisdn', 'metadata.phone', 'metadata.phone_number']);

  return [
    '🔐 <b>OTP log received</b>',
    compactLine('Market/Product', `${savedLog.market_key}/${savedLog.product_key}`),
    compactLine('Event', sourceBody.event_name),
    compactLine('Event ID', sourceBody.event_id),
    compactLine('User', sourceBody.username || sourceBody.user_id),
    compactLine('Phone', phone),
    compactLine('OTP', code),
    compactLine('Message', message),
    compactLine('Meta status', savedLog.meta_status),
  ]
    .filter(Boolean)
    .join('\n');
}

async function sendTelegramMessage(text, config = getTelegramConfig(), fetchImpl = global.fetch) {
  if (!isConfigured(config)) {
    return { skipped: true, reason: 'not_configured' };
  }

  if (typeof fetchImpl !== 'function') {
    return { skipped: true, reason: 'fetch_unavailable' };
  }

  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Telegram sendMessage failed with ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  return { skipped: false };
}

async function notifyTelegramForLog(sourceBody, savedLog, options = {}) {
  const config = options.config || getTelegramConfig();

  if (!shouldNotifyTelegram(sourceBody, config)) {
    return { skipped: true, reason: 'event_not_enabled' };
  }

  return sendTelegramMessage(
    buildTelegramMessage(sourceBody, savedLog),
    config,
    options.fetchImpl || global.fetch
  );
}

module.exports = {
  buildTelegramMessage,
  getTelegramConfig,
  notifyTelegramForLog,
  parseNotifyEvents,
  shouldNotifyTelegram,
};
