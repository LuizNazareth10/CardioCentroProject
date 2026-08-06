# Backup e recuperação do Firestore

Projeto: `cardiocentro-pipeline` · Banco: `(default)` · Região: `southamerica-east1`

Configurado em 06/08/2026. **Já está ativo** — nada aqui precisa ser rodado de novo,
exceto os procedimentos de restauração.

## O que está ligado

| Proteção | Cobertura | Serve para |
|---|---|---|
| **Point-in-time recovery (PITR)** | Últimos **7 dias**, granularidade de 1 minuto | Erro humano recente: exclusão acidental pela tela, script de manutenção que rodou errado, migração com bug |
| **Backup diário** | Retenção de **7 dias** | Voltar ao estado de um dia específico da semana |
| **Backup semanal** (domingo) | Retenção de **14 semanas** | Recuperação de um problema descoberto tarde — corrupção que passou despercebida por semanas |

As três camadas se complementam: PITR resolve "há duas horas", o diário resolve
"anteontem", o semanal resolve "isso quebrou no mês passado e ninguém viu".

## Verificar que continua ativo

```bash
gcloud firestore databases list --project=cardiocentro-pipeline \
  --format="table(name.basename(),pointInTimeRecoveryEnablement)"

gcloud firestore backups schedules list --database='(default)' \
  --project=cardiocentro-pipeline
```

Esperado: `POINT_IN_TIME_RECOVERY_ENABLED` e dois agendamentos
(retenção `604800s` = 7 dias, e `8467200s` = 14 semanas).

Vale conferir uma vez por trimestre. Também vale listar os backups já gerados:

```bash
gcloud firestore backups list --location=southamerica-east1 \
  --project=cardiocentro-pipeline
```

---

## Restauração

> **Leia antes de executar:** o Firestore **não** restaura por cima do banco
> existente. Toda restauração cria um **banco novo**, e a aplicação continua
> apontando para o antigo até você trocar a configuração. Isso é proposital —
> permite inspecionar o que foi recuperado antes de promover.

### Caso 1 — erro recente (dentro de 7 dias): PITR

Cenário típico: alguém excluiu um paciente ou uma leva de agendamentos hoje de manhã.

```bash
# 1. Restaurar o estado de um instante específico para um banco NOVO.
#    O timestamp é UTC e deve estar dentro dos últimos 7 dias.
gcloud firestore databases restore \
  --source-database='(default)' \
  --snapshot-time='2026-08-06T13:00:00Z' \
  --destination-database='recuperacao-20260806' \
  --project=cardiocentro-pipeline

# 2. Inspecionar o banco recuperado no console antes de qualquer decisão:
#    https://console.cloud.google.com/firestore/databases?project=cardiocentro-pipeline
```

Na maioria dos casos o certo é **copiar à mão só os documentos afetados** do banco
de recuperação para o de produção — não trocar o banco inteiro. Trocar tudo
descartaria todo o trabalho legítimo feito desde o instante restaurado.

### Caso 2 — problema antigo: restaurar de um backup

```bash
# 1. Listar os backups disponíveis e copiar o nome completo do escolhido
gcloud firestore backups list --location=southamerica-east1 \
  --project=cardiocentro-pipeline

# 2. Restaurar para um banco novo
gcloud firestore databases restore \
  --source-backup=projects/cardiocentro-pipeline/locations/southamerica-east1/backups/BACKUP_ID \
  --destination-database='recuperacao-20260806' \
  --project=cardiocentro-pipeline
```

### Promover um banco recuperado para produção

Só faça isso se a decisão for descartar tudo que aconteceu depois do ponto restaurado.

1. Colocar o agente em `paused` na tela **Configurações → Rollout do agente**, para
   não gravar nada novo durante a troca.
2. Definir `FIRESTORE_DATABASE_ID` (ou o ID do banco na configuração do Admin SDK)
   apontando para o banco recuperado, e reimplantar na Vercel.
3. Validar a área restrita com calma — agenda do dia, busca de paciente, um prontuário.
4. Voltar o agente para o modo anterior.

### Depois de qualquer restauração

Bancos de recuperação **continuam custando** enquanto existirem. Apague quando terminar:

```bash
gcloud firestore databases delete --database='recuperacao-20260806' \
  --project=cardiocentro-pipeline
```

---

## Custo

PITR e backups são cobrados por volume armazenado. Para o porte da clínica
(~19 mil pacientes, ~94 mil agendamentos), a ordem de grandeza é de **poucos dólares
por mês** — comparável ao custo do próprio Firestore.

## Teste de restauração

Um backup nunca testado não é um backup. Vale fazer um ensaio uma vez por semestre:
restaurar para um banco temporário, conferir que os dados estão lá, e apagar.
Leva 15 minutos e é a única forma de saber que a recuperação funciona **antes** de
precisar dela.
