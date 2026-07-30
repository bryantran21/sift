// Keyword-lexicon skill/technology extractor. Given a plain-text job description it
// returns the concrete technical skills it mentions — fast, deterministic, no LLM.
// Used by the job-detail panel; reusable later for résumé↔job matching (the intended
// Phase-2 of scoring/resume.ts). Precision over recall: only well-known, unambiguous
// terms are in the lexicon so a JD's prose doesn't produce noise.
//
// Each entry is [canonical label, matcher]. Order = rough importance; output preserves
// this order for stable display. Matchers bake in their own boundaries because several
// tokens contain non-word characters (c++, c#, .net, ci/cd, node.js).

type Skill = [string, RegExp];

// Helper for plain alphanumeric terms → whole-word, case-insensitive.
const w = (word: string) => new RegExp(`\\b${word}\\b`, 'i');

const SKILLS: Skill[] = [
  // ── Languages ──────────────────────────────────────────────────────────────
  ['Python', w('python')],
  ['Java', w('java')], // \bjava\b won't match inside "javascript" (no boundary mid-word)
  ['JavaScript', w('javascript')],
  ['TypeScript', w('typescript')],
  ['Go', /\bgolang\b/i], // bare "Go" is too common in prose; require "golang"
  ['Rust', w('rust')],
  ['C++', /(?<![a-z0-9+#])c\+\+/i],
  ['C#', /(?<![a-z0-9+#])c#/i],
  ['Objective-C', /\bobjective-?c\b/i],
  ['Ruby', w('ruby')],
  ['PHP', w('php')],
  ['Scala', w('scala')],
  ['Kotlin', w('kotlin')],
  ['Swift', w('swift')],
  ['MATLAB', w('matlab')],
  ['SQL', w('sql')],
  ['Bash/Shell', /\b(bash|shell scripting)\b/i],

  // ── Web / app frameworks ───────────────────────────────────────────────────
  ['React', /\breact(\.js)?\b/i],
  ['Angular', w('angular')],
  ['Vue', /\bvue(\.js)?\b/i],
  ['Node.js', /\bnode(\.js)?\b/i],
  ['Next.js', /\bnext\.?js\b/i],
  ['Django', w('django')],
  ['Flask', w('flask')],
  ['FastAPI', w('fastapi')],
  ['Spring', /\bspring( boot)?\b/i],
  ['Rails', /\b(ruby on rails|rails)\b/i],
  ['.NET', /(?<![a-z0-9])\.net\b/i],

  // ── ML / data ──────────────────────────────────────────────────────────────
  ['Machine Learning', /\bmachine learning\b/i],
  ['Deep Learning', /\bdeep learning\b/i],
  ['NLP', /\b(nlp|natural language processing)\b/i],
  ['Computer Vision', /\bcomputer vision\b/i],
  ['LLMs', /\b(llms?|large language models?)\b/i],
  ['Reinforcement Learning', /\breinforcement learning\b/i],
  ['PyTorch', w('pytorch')],
  ['TensorFlow', w('tensorflow')],
  ['JAX', w('jax')],
  ['Keras', w('keras')],
  ['scikit-learn', /\b(scikit-?learn|sklearn)\b/i],
  ['pandas', w('pandas')],
  ['NumPy', w('numpy')],
  ['Spark', /\b(apache )?spark\b/i],
  ['Kafka', /\b(apache )?kafka\b/i],
  ['Airflow', /\b(apache )?airflow\b/i],
  ['dbt', /\bdbt\b/i],
  ['MLOps', w('mlops')],
  ['ETL', w('etl')],

  // ── Infra / cloud / data stores ────────────────────────────────────────────
  ['AWS', /\b(aws|amazon web services)\b/i],
  ['GCP', /\b(gcp|google cloud)\b/i],
  ['Azure', w('azure')],
  ['Kubernetes', /\b(kubernetes|k8s)\b/i],
  ['Docker', w('docker')],
  ['Terraform', w('terraform')],
  ['Ansible', w('ansible')],
  ['CI/CD', /\bci\/?cd\b/i],
  ['Linux', w('linux')],
  ['Redis', w('redis')],
  ['PostgreSQL', /\b(postgresql|postgres)\b/i],
  ['MySQL', w('mysql')],
  ['MongoDB', w('mongodb')],
  ['Elasticsearch', w('elasticsearch')],
  ['GraphQL', w('graphql')],
  ['gRPC', w('grpc')],
  ['Snowflake', w('snowflake')],
  ['Databricks', w('databricks')],
  ['Tableau', w('tableau')],

  // ── Concepts ───────────────────────────────────────────────────────────────
  ['Distributed Systems', /\bdistributed systems?\b/i],
  ['Microservices', /\bmicro-?services?\b/i],
  ['REST APIs', /\b(rest(ful)?|rest api)\b/i],
  ['Data Structures', /\bdata structures?\b/i],
];

export function extractSkills(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const [label, pattern] of SKILLS) {
    if (seen.has(label)) continue;
    if (pattern.test(text)) {
      out.push(label);
      seen.add(label);
    }
  }
  return out;
}
