const mineflayer = require('mineflayer');
const http = require('http');

const cfg = {
  host: process.env.MC_HOST || 'kingdomclash879.mcsh.io',
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.MC_USERNAME || 'KingdomBot',
  password: process.env.MC_PASSWORD || '',
  version: process.env.MC_VERSION || false,
  auth: process.env.MC_AUTH || 'offline',
  registerCommand: process.env.REGISTER_COMMAND || '/register {password} {password}',
  loginCommand: process.env.LOGIN_COMMAND || '/login {password}',
  reconnectDelay: Number(process.env.RECONNECT_DELAY || 10000),
  loginDelay: Number(process.env.LOGIN_DELAY || 2500),
};

let bot = null;
let reconnectTimer = null;
let shuttingDown = false;
let authenticatedThisSession = false;

function sendCommand(template) {
  if (!bot || !cfg.password) return;
  const command = template.replaceAll('{password}', cfg.password);
  bot.chat(command);
  console.log(`[AUTH] Enviado: ${command.replaceAll(cfg.password, '******')}`);
}

function scheduleReconnect() {
  if (shuttingDown || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, cfg.reconnectDelay);
}

function createBot() {
  console.log(`[BOT] Conectando em ${cfg.host}:${cfg.port} como ${cfg.username}...`);

  bot = mineflayer.createBot({
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    version: cfg.version || undefined,
    auth: cfg.auth,
  });

  bot.once('login', () => {
    console.log('[BOT] Conectado ao servidor.');
  });

  bot.once('spawn', () => {
    console.log('[BOT] Spawn concluído.');
    authenticatedThisSession = false;
    setTimeout(() => {
      if (!bot || authenticatedThisSession) return;
      // UserLogin/AuthMe-style plugins usually accept /login or /register.
      // The bot listens to server messages and only sends a command when a
      // corresponding prompt is detected. This avoids blindly registering.
      console.log('[AUTH] Aguardando mensagem do plugin de login...');
    }, cfg.loginDelay);
  });

  bot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString().replace(/\u00a7[0-9A-FK-OR]/gi, '');
    const lower = text.toLowerCase();

    if (!cfg.password) return;

    const asksRegister =
      /\/register|registr(e|ar)|registre|crie uma senha|create.*password|register.*password/i.test(lower);
    const asksLogin =
      /\/login|log(in|ar)|entre|senha|password|authenticate|autentique/i.test(lower);

    // If the plugin explicitly asks to register, register first.
    if (asksRegister && !/already registered|já (está )?registrad|ja (esta )?registrad|already exists/i.test(lower)) {
      sendCommand(cfg.registerCommand);
      authenticatedThisSession = true;
      return;
    }

    // If it asks for login/password, log in.
    if (asksLogin && !asksRegister) {
      sendCommand(cfg.loginCommand);
      authenticatedThisSession = true;
    }
  });

  bot.on('kicked', (reason) => {
    console.log('[BOT] Expulso:', typeof reason === 'string' ? reason : JSON.stringify(reason));
  });

  bot.on('error', (err) => {
    console.error('[BOT] Erro:', err.message || err);
  });

  bot.on('end', (reason) => {
    console.log('[BOT] Conexão encerrada:', reason || 'sem motivo informado');
    bot = null;
    authenticatedThisSession = false;
    scheduleReconnect();
  });
}

const healthPort = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
  res.end('KingdomClash Mineflayer Bot: online\n');
}).listen(healthPort, '0.0.0.0', () => {
  console.log(`[WEB] Health check ouvindo na porta ${healthPort}.`);
});

process.on('SIGTERM', () => {
  shuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (bot) bot.quit('Encerrando serviço');
  process.exit(0);
});

process.on('SIGINT', () => {
  shuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (bot) bot.quit('Encerrando serviço');
  process.exit(0);
});

createBot();
