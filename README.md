# BetSim / InimigosBet

Este projeto inclui um frontend estático (HTML) e um backend Node.js simples para autenticação (login/registro), saldo e logs online dos jogos.

## Como executar

1. Instale as dependências e inicie o servidor:

```
npm install
npm start
```

O servidor iniciará em `http://localhost:3000` e também servirá os arquivos HTML do frontend.

2. Acesse `http://localhost:3000/login.html` para registrar e fazer login. O primeiro registro cria a conta com saldo inicial de R$ 100,00.

3. Após o login, navegue para `dashboard.html` e jogue os jogos. Os logs e saldo são persistidos no servidor (arquivo `data/db.json`).

## API (resumo)

- POST `/api/register`: { username, password }
- POST `/api/login`: { username, password } => { token, user }
- GET `/api/me` (Bearer token): perfil do usuário logado
- POST `/api/balance` (Bearer token): { delta, reason } altera saldo e registra log bancário
- POST `/api/game-transaction` (Bearer token): { type, amount, details, game } altera saldo e registra log de jogo de forma atômica
- GET `/api/logs` (Bearer token): filtros opcionais `user`, `game`, `type`, `date`

## Observações

- O token é salvo no `localStorage` como `authToken`.
- Cada operação de jogo usa `/api/game-transaction` para garantir consistência entre saldo e logs.
- Os arquivos HTML foram atualizados para exigir login e consumir a API real.