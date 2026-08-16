const mineflayer = require('mineflayer');
const http = require('http');

const cfg = {
  host: process.env.MC_HOST || 'kingdomclash879.mcsh.io',
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.MC_USERNAME || 'Game',
  password: process.env.MC_PASSWORD || '',
  version: process.env.MC_VERSION || false,
  auth: process.env.MC_AUTH || 'offline',

  registerCommand:
    process.env.REGISTER_COMMAND || '/register {password} {password}',

  loginCommand:
    process.env.LOGIN_COMMAND || '/login {password}',

  reconnectDelay:
    Number(process.env.RECONNECT_DELAY || 10000),

  loginDelay:
    Number(process.env.LOGIN_DELAY || 2500),

  // A cada 30 segundos mostramos que o processo continua vivo.
  heartbeatInterval:
    Number(process.env.HEARTBEAT_INTERVAL || 30000),
};

let bot = null;
let reconnectTimer = null;
let heartbeatTimer = null;

let shuttingDown = false;
let authenticatedThisSession = false;
let connecting = false;
let connectionStartedAt = null;

function maskPassword(text) {
  if (!cfg.password) return text;
  return text.replaceAll(cfg.password, '******');
}

function sendCommand(template) {
  if (!bot || !cfg.password) {
    console.log('[AUTH] Não foi possível enviar comando: bot ou senha ausente.');
    return;
  }

  try {
    const command = template.replaceAll('{password}', cfg.password);

    bot.chat(command);

    console.log(`[AUTH] Enviado: ${maskPassword(command)}`);
  } catch (err) {
    console.error('[AUTH] Erro ao enviar comando:', err.message || err);
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(reason = 'desconexão') {
  if (shuttingDown) return;

  if (reconnectTimer) {
    console.log('[BOT] Reconexão já está agendada.');
    return;
  }

  console.log(
    `[BOT] Reconexão agendada em ${cfg.reconnectDelay / 1000}s. Motivo: ${reason}`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    if (shuttingDown) return;

    createBot();
  }, cfg.reconnectDelay);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (shuttingDown) return;

    if (!bot) {
      console.log('[WATCHDOG] Nenhum bot conectado. Reconexão será verificada.');

      scheduleReconnect('watchdog detectou ausência do bot');
      return;
    }

    const aliveFor = connectionStartedAt
      ? Math.floor((Date.now() - connectionStartedAt) / 1000)
      : 0;

    console.log(
      `[WATCHDOG] Bot ativo. Conectado há ${aliveFor}s | servidor=${cfg.host}:${cfg.port}`
    );
  }, cfg.heartbeatInterval);
}

function destroyCurrentBot() {
  if (!bot) return;

  try {
    bot.removeAllListeners();
  } catch (_) {}

  try {
    bot.quit('Reconectando');
  } catch (_) {}

  bot = null;
  authenticatedThisSession = false;
  connecting = false;

  stopHeartbeat();
}

function createBot() {
  if (shuttingDown) return;

  if (connecting) {
    console.log('[BOT] Já existe uma conexão em andamento.');
    return;
  }

  if (bot) {
    console.log('[BOT] Já existe um bot ativo. Não criando outro.');
    return;
  }

  connecting = true;

  console.log('');
  console.log('==========================================');
  console.log('[BOT] INICIANDO CONEXÃO');
  console.log(`      Servidor: ${cfg.host}:${cfg.port}`);
  console.log(`      Usuário:  ${cfg.username}`);
  console.log(`      Auth:     ${cfg.auth}`);
  console.log('==========================================');

  try {
    const newBot = mineflayer.createBot({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      version: cfg.version || undefined,
      auth: cfg.auth,
    });

    bot = newBot;

    bot.once('login', () => {
      connecting = false;
      connectionStartedAt = Date.now();

      console.log('[BOT] ========================================');
      console.log('[BOT] CONECTADO AO SERVIDOR');
      console.log('[BOT] ========================================');

      startHeartbeat();
    });

    bot.once('spawn', () => {
      console.log('[BOT] Spawn concluído.');

      authenticatedThisSession = false;

      setTimeout(() => {
        if (!bot || shuttingDown || authenticatedThisSession) return;

        console.log('[AUTH] Aguardando mensagem do plugin de login...');
      }, cfg.loginDelay);
    });

    bot.on('message', (jsonMsg) => {
      if (!bot || shuttingDown) return;

      let text = '';

      try {
        text = jsonMsg
          .toString()
          .replace(/\u00a7[0-9A-FK-OR]/gi, '');
      } catch (err) {
        console.error('[AUTH] Não foi possível interpretar mensagem:', err);
        return;
      }

      const lower = text.toLowerCase();

      if (!cfg.password) {
        console.log('[AUTH] Mensagem recebida, mas MC_PASSWORD não está configurada.');
        return;
      }

      console.log(`[SERVER MSG] ${text}`);

      const alreadyRegistered =
        /already registered|já (está )?registrad|ja (esta )?registrad|already exists|conta já registrada|conta ja registrada/i.test(
          lower
        );

      const asksRegister =
        /\/register|registr(e|ar)|registre|crie uma senha|create.*password|register.*password/i.test(
          lower
        );

      const asksLogin =
        /\/login|log(in|ar)|entre|senha|password|authenticate|autentique/i.test(
          lower
        );

      // Se o servidor pedir explicitamente REGISTER,
      // fazemos o registro somente se a conta ainda não estiver registrada.
      if (asksRegister && !alreadyRegistered) {
        if (!authenticatedThisSession) {
          sendCommand(cfg.registerCommand);
          authenticatedThisSession = true;
        }

        return;
      }

      // Se o servidor informar que já existe/está registrada,
      // fazemos LOGIN.
      if (alreadyRegistered && asksLogin) {
        if (!authenticatedThisSession) {
          sendCommand(cfg.loginCommand);
          authenticatedThisSession = true;
        }

        return;
      }

      // Prompt normal de login.
      if (asksLogin && !asksRegister) {
        if (!authenticatedThisSession) {
          sendCommand(cfg.loginCommand);
          authenticatedThisSession = true;
        }
      }
    });

    bot.on('kicked', (reason) => {
      console.log('');
      console.log('[BOT] ========================================');
      console.log('[BOT] BOT FOI EXPULSO');
      console.log('[BOT] Motivo:', typeof reason === 'string'
        ? reason
        : JSON.stringify(reason));
      console.log('[BOT] ========================================');

      authenticatedThisSession = false;

      scheduleReconnect('bot foi expulso (kicked)');
    });

    bot.on('error', (err) => {
      console.error('');
      console.error('[BOT] ========================================');
      console.error('[BOT] ERRO DO MINEFLAYER');
      console.error('[BOT] Mensagem:', err?.message || err);
      console.error('[BOT] Código:', err?.code || 'sem código');
      console.error('[BOT] ========================================');

      // O evento error nem sempre significa que a conexão acabou.
      // O evento end normalmente virá em seguida.
      // Ainda assim, deixamos uma reconexão preparada.
      scheduleReconnect(`erro: ${err?.code || err?.message || 'desconhecido'}`);
    });

    bot.on('end', (reason) => {
      console.log('');
      console.log('[BOT] ========================================');
      console.log('[BOT] CONEXÃO ENCERRADA');
      console.log('[BOT] Motivo:', reason || 'sem motivo informado');
      console.log('[BOT] ========================================');

      authenticatedThisSession = false;
      connectionStartedAt = null;

      stopHeartbeat();

      // Só limpamos se este ainda for o bot atual.
      if (bot === newBot) {
        bot = null;
      }

      connecting = false;

      scheduleReconnect(`evento end: ${reason || 'sem motivo'}`);
    });

    bot.on('close', () => {
      console.log('[BOT] Socket Minecraft fechado.');

      if (!shuttingDown && bot === newBot) {
        scheduleReconnect('socket fechado');
      }
    });

  } catch (err) {
    console.error('[BOT] Falha ao criar o bot:', err.message || err);

    connecting = false;
    bot = null;

    scheduleReconnect('falha ao criar conexão');
  }
}

/*
 * Health check do Render.
 * O servidor HTTP fica ativo independentemente da conexão Minecraft.
 */
const healthPort = Number(process.env.PORT || 10000);

http
  .createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

    res.end('KingdomClash Mineflayer Bot: online\n');
  })
  .listen(healthPort, '0.0.0.0', () => {
    console.log(`[WEB] Health check ouvindo na porta ${healthPort}.`);
  });

function shutdown(signal) {
  console.log(`[SYSTEM] Recebido ${signal}. Encerrando...`);

  shuttingDown = true;

  clearReconnectTimer();
  stopHeartbeat();

  if (bot) {
    try {
      bot.quit('Encerrando serviço');
    } catch (err) {
      console.error('[SYSTEM] Erro ao encerrar bot:', err.message || err);
    }
  }

  bot = null;

  setTimeout(() => {
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('');
  console.error('[SYSTEM] ========================================');
  console.error('[SYSTEM] UNCAUGHT EXCEPTION');
  console.error('[SYSTEM] ', err?.stack || err);
  console.error('[SYSTEM] ========================================');

  if (!shuttingDown) {
    scheduleReconnect('uncaughtException');
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('');
  console.error('[SYSTEM] ========================================');
  console.error('[SYSTEM] UNHANDLED REJECTION');
  console.error('[SYSTEM] ', reason);
  console.error('[SYSTEM] ========================================');
});

/*
 * Início do bot
 */
console.log('[SYSTEM] KingdomClash Mineflayer Bot iniciando...');
console.log(`[SYSTEM] Host: ${cfg.host}`);
console.log(`[SYSTEM] Porta: ${cfg.port}`);
console.log(`[SYSTEM] Usuário: ${cfg.username}`);
console.log(`[SYSTEM] Reconexão: ${cfg.reconnectDelay}ms`);

createBot();
