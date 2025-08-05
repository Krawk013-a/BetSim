# BetSim - Casa de Apostas Simulada

## 📋 Resumo das Melhorias Implementadas

Este projeto é uma casa de apostas simulada desenvolvida para fins acadêmicos, demonstrando a legalização das casas de apostas no Brasil. Todas as transações são simuladas e nenhum dinheiro real é utilizado.

## 🎮 Jogos Disponíveis

### 1. **Mines** 💣
- **Problema Resolvido**: Layout otimizado para evitar scroll desnecessário
- **Funcionalidades**:
  - Seleção de número de minas (1, 3, 5, 10, 15)
  - Sistema de multiplicadores dinâmicos
  - Cashout em tempo real
  - Interface responsiva sem scroll

### 2. **Crash** 📈
- **Novo Jogo**: Implementado com gráfico em tempo real
- **Funcionalidades**:
  - Gráfico animado com Canvas
  - Sistema de apostas e cashout
  - Multiplicadores crescentes
  - Ponto de crash aleatório

### 3. **Roleta** 🎲
- **Novo Jogo**: Roleta completa com apostas múltiplas
- **Funcionalidades**:
  - Apostas em números específicos (35:1)
  - Apostas em cores (Vermelho/Preto - 2:1)
  - Apostas em paridade (Par/Ímpar - 2:1)
  - Animação de rotação da roda
  - Zero verde com pagamento especial

### 4. **Aviator** ✈️
- **Jogo Existente**: Mantido com melhorias no sistema de logs
- **Funcionalidades**:
  - Avião que decola com multiplicador crescente
  - Sistema de cashout antes do crash
  - Histórico de rodadas

## 📊 Sistema de Logs e Planilhas

### Funcionalidades Implementadas:

1. **Logs Detalhados**:
   - Data e hora de cada transação
   - Usuário responsável
   - Jogo específico
   - Tipo de transação (Aposta, Ganho, Depósito, Saque)
   - Valor da transação
   - Detalhes específicos
   - ID de sessão único

2. **Página de Administração** (`logs.html`):
   - Visualização de todos os logs
   - Filtros por usuário, jogo, tipo e data
   - Estatísticas em tempo real
   - Exportação para CSV
   - Paginação dos resultados

3. **Estatísticas Gerais**:
   - Total de jogos realizados
   - Número de usuários únicos
   - Volume total de transações
   - Lucro total do sistema

### Como Acessar os Logs:

1. Faça login no sistema
2. No dashboard, clique em "Logs do Sistema"
3. Use os filtros para encontrar informações específicas
4. Clique em "Exportar CSV" para baixar os dados

## 🎯 Melhorias na Experiência do Usuário

### 1. **Layout Otimizado**:
- Todos os jogos agora cabem na tela sem necessidade de scroll
- Interface responsiva e moderna
- Elementos redimensionados para melhor visualização

### 2. **Jogos Populares Brasileiros**:
- **Crash**: Similar ao popular jogo das casas de apostas brasileiras
- **Roleta**: Implementação completa com todas as apostas tradicionais
- **Mines**: Melhorado com interface otimizada
- **Aviator**: Mantido com sistema de logs aprimorado

### 3. **Sistema de Transações**:
- Histórico completo de todas as operações
- Rastreamento de ganhos e perdas por usuário
- Sistema de depósitos e saques
- Logs detalhados para análise

## 🔧 Tecnologias Utilizadas

- **HTML5**: Estrutura semântica
- **CSS3**: Estilização moderna e responsiva
- **JavaScript**: Lógica dos jogos e sistema de logs
- **Canvas API**: Gráficos animados (Crash)
- **LocalStorage**: Persistência de dados
- **CSV Export**: Exportação de dados para planilhas

## 📁 Estrutura de Arquivos

```
├── login.html          # Página de login
├── dashboard.html      # Dashboard principal
├── mines.html         # Jogo Mines (otimizado)
├── crash.html         # Novo jogo Crash
├── roulette.html      # Novo jogo Roleta
├── aviator.html       # Jogo Aviator (melhorado)
├── logs.html          # Sistema de logs e administração
└── README.md          # Documentação
```

## 🚀 Como Usar

1. **Acesse** `login.html` para fazer login
2. **Navegue** pelo dashboard para escolher um jogo
3. **Jogue** qualquer um dos jogos disponíveis
4. **Acesse** os logs através do dashboard para ver estatísticas
5. **Exporte** os dados para análise em planilhas

## 📈 Funcionalidades de Logs

### Dados Capturados:
- **Timestamp**: Data e hora exata
- **Usuário**: Nome do jogador
- **Jogo**: Mines, Crash, Roleta, Aviator
- **Tipo**: Aposta, Ganho, Depósito, Saque
- **Valor**: Valor da transação (positivo/negativo)
- **Detalhes**: Informações específicas da jogada
- **ID Sessão**: Identificador único da sessão

### Exportação:
- Formato CSV compatível com Excel/Google Sheets
- Filtros aplicados mantidos na exportação
- Nome do arquivo com data atual
- Codificação UTF-8 para caracteres especiais

## ⚠️ Importante

Este é um **simulador acadêmico** para fins educacionais sobre a legalização das casas de apostas no Brasil. Nenhuma transação real é realizada e nenhum dinheiro real é utilizado.

## 🎓 Objetivo Acadêmico

O projeto demonstra:
- Funcionalidades de casas de apostas populares no Brasil
- Sistema de logs e rastreamento de transações
- Interface moderna e responsiva
- Exportação de dados para análise
- Experiência do usuário otimizada

---

**Desenvolvido para TCC sobre Legalização das Casas de Apostas no Brasil**