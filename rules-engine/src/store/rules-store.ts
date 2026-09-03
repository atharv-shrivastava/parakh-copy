import { Pool } from 'pg';
import type { RuleDefinition } from '../../domain/types.js';
import { RULES } from '../legal/rules.js';

const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 5,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : null;

function rowToRule(row: Record<string, unknown>): RuleDefinition {
  const definition = row.definition;
  if (!definition || typeof definition !== 'object') {
    throw new Error(`Compliance rule ${String(row.ruleId)} has an invalid definition.`);
  }
  return definition as RuleDefinition;
}

export async function ensureBuiltinRules(): Promise<void> {
  if (!pool) return;

  for (const rule of RULES) {
    await pool.query(
      `INSERT INTO "ComplianceRule" ("id","ruleId","ruleCode","ruleNumber","subclause","title","description","category","defaultSeverity","enabled","isBuiltin","definition","updatedAt")
       VALUES (concat('clr_', substr(md5(random()::text || clock_timestamp()::text), 1, 22)), $1,$2,$3,$4,$5,$6,$7,$8,$9,true,true,$10::jsonb,now())
       ON CONFLICT ("ruleId") DO NOTHING`,
      [
        rule.ruleId,
        rule.ruleCode,
        rule.ruleNumber,
        rule.subclause ?? null,
        rule.title,
        rule.description,
        rule.category,
        rule.defaultSeverity,
        rule.enabled,
        JSON.stringify(rule),
      ],
    );
  }
}

export async function loadActiveRules(): Promise<RuleDefinition[]> {
  if (!pool) return RULES;

  try {
    await ensureBuiltinRules();
    const { rows } = await pool.query(
      `SELECT "ruleId","definition" FROM "ComplianceRule" WHERE "enabled" = true ORDER BY "ruleCode" ASC`,
    );
    if (!rows.length) return RULES;
    return rows.map(rowToRule);
  } catch (error) {
    console.warn('[rules-engine] Database rules unavailable, using built-in rules:', error instanceof Error ? error.message : error);
    return RULES;
  }
}

export async function closeRulesStore(): Promise<void> {
  if (pool) await pool.end();
}
