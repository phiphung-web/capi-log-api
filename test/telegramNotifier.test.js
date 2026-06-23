const assert = require('assert');
const test = require('node:test');

const {
  buildTelegramMessage,
  notifyTelegramForLog,
  shouldNotifyTelegram,
} = require('../src/utils/telegramNotifier');

const savedLog = {
  market_key: 'vn',
  product_key: 'app',
  event_id: 'evt-1',
  meta_status: 'received',
};

test('Telegram OTP detection matches OTP event names and payload fields', () => {
  assert.equal(shouldNotifyTelegram({ event_name: 'OtpReceived' }), true);
  assert.equal(shouldNotifyTelegram({ event_name: 'SmsReceived', otp_code: '123456' }), true);
  assert.equal(shouldNotifyTelegram({ event_name: 'Purchase', value: 100 }), false);
});

test('Telegram event allowlist can include balance events without sending every log', () => {
  const config = { notifyEvents: 'OtpReceived,BalanceChanged' };

  assert.equal(shouldNotifyTelegram({ event_name: 'BalanceChanged' }, config), true);
  assert.equal(shouldNotifyTelegram({ event_name: 'Purchase', otp_code: '123456' }, config), false);
});

test('Telegram message includes escaped OTP content', () => {
  const text = buildTelegramMessage(
    {
      event_name: 'OtpReceived',
      event_id: 'evt-1',
      otp_code: '<123456>',
      message: 'Your OTP is <123456>',
      phone: '+84900000000',
    },
    savedLog
  );

  assert.match(text, /OTP log received/);
  assert.match(text, /&lt;123456&gt;/);
  assert.doesNotMatch(text, /<123456>/);
});

test('Telegram notifier posts sendMessage when configured and enabled', async () => {
  const calls = [];
  const result = await notifyTelegramForLog(
    { event_name: 'OtpReceived', event_id: 'evt-1', otp_code: '123456' },
    savedLog,
    {
      config: { botToken: 'token', chatId: 'chat', notifyEvents: '' },
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true };
      },
    }
  );

  assert.deepEqual(result, { skipped: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bottoken/sendMessage');
  assert.equal(JSON.parse(calls[0].options.body).chat_id, 'chat');
});
