# KingdomClash Mineflayer Bot

Bot Node.js + Mineflayer para conectar no servidor:

`kingdomclash879.mcsh.io`

## O que já está configurado

- Mineflayer
- reconexão automática
- health check HTTP para hospedagens que exigem uma porta HTTP
- `/register senha senha` quando o servidor indicar registro
- `/login senha` quando o servidor indicar login
- senha por variável de ambiente (não colocar no GitHub)
- configuração pronta para Render

## IMPORTANTE sobre MCServerHost e Render

Use o bot para manter o servidor conectado somente se isso for permitido pelos termos/configurações do seu provedor.

O `render.yaml` usa um Web Service Free para facilitar o deploy/teste. O plano Free do Render pode colocar Web Services para dormir após 15 minutos sem tráfego HTTP/WebSocket; portanto ele NÃO é uma garantia de bot 24/7. Para um processo Minecraft contínuo, use uma instância/serviço que permita processos contínuos (por exemplo, um Background Worker pago ou outra hospedagem que autorize isso).

## GitHub

1. Crie um repositório vazio no GitHub.
2. Envie todos os arquivos desta pasta.
3. NÃO envie `.env` nem a senha real.

## Render

1. New -> Web Service.
2. Conecte o repositório GitHub.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Adicione as variáveis:

MC_HOST=kingdomclash879.mcsh.io
MC_PORT=25565
MC_USERNAME=SEU_NOME_DO_BOT
MC_PASSWORD=SUA_SENHA
MC_VERSION=1.21.11
MC_AUTH=offline
REGISTER_COMMAND=/register {password} {password}
LOGIN_COMMAND=/login {password}

A variável `PORT` é fornecida automaticamente pelo Render.

## Sobre a autenticação

Este projeto assume que o servidor usa autenticação por comando (como UserLogin/AuthMe) e que o bot entra em modo offline.

Se o servidor estiver com `online-mode=true` e exigir uma conta Microsoft/Minecraft Java autenticada, `MC_AUTH=offline` não será suficiente. Nesse caso, a configuração precisa ser alterada de acordo com o modo de autenticação do servidor.

## Segurança

Nunca coloque sua senha real em:

- bot.js
- README.md
- package.json
- GitHub
- prints públicos

Coloque a senha somente nas Environment Variables do serviço.

## Teste local

```bash
npm install
```

No Windows PowerShell, defina as variáveis de ambiente ou use um arquivo `.env` local (não faça commit dele), depois:

```bash
npm start
```
