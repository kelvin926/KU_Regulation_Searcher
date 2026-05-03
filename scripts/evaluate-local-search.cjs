const fs = require("node:fs");
const path = require("node:path");
const BetterSqlite3 = require("better-sqlite3");
const { DatabaseService } = require("../dist/main/db/database.js");
const { SearchService } = require("../dist/main/search/fts-search.js");

const DEFAULT_COUNT = 5000;
const DEFAULT_SEARCH_LIMIT = 30;
const DEFAULT_AI_LIMIT = 12;
const DEFAULT_MIN_PASS_RATE = 0.92;
const DEFAULT_STYLE = "standard";
const DEFAULT_SEED = 20260503;

const CATEGORY_WEIGHTS = {
  article_lookup: 90,
  title_lookup: 120,
  procedure: 95,
  duration: 95,
  eligibility: 70,
  amount: 30,
};

const COMPLEX_CATEGORY_WEIGHTS = {
  article_lookup: 110,
  title_lookup: 150,
  procedure: 170,
  duration: 130,
  eligibility: 150,
  amount: 70,
  evidence_check: 120,
  exception_check: 100,
};

const GENERIC_TITLES = new Set(["목적", "정의", "용어의 정의", "부칙", "시행일", "적용범위", "삭제"]);
const PROCEDURE_TITLE = /신청|제출|승인|허가|절차|원서|접수|신고|심의|선정|임명|반납|취소|변경|등록/u;
const DURATION_TITLE = /기간|기한|학기|연한|시기|일수|기일|유효기간|제출기한|신청기간/u;
const ELIGIBILITY_TITLE = /대상|자격|요건|조건|선발기준|선발|지원자격|제한|기준|요건/u;
const AMOUNT_TITLE = /장학금액|금액|지급|등록금|수업료|수당|급여|지원비|연구비|감면|대관료|사용료/u;
const EXCEPTION_BODY = /다만|제외|예외|아니한다|초과|제한|연장|면제|포함하지/u;
const BODY_HINT_STOP_WORDS = new Set([
  "각호",
  "다음",
  "경우",
  "사항",
  "하여야",
  "한다",
  "하며",
  "이하",
  "이상",
  "이내",
  "해당",
  "관련",
  "규정",
  "세칙",
  "내규",
  "학칙",
  "조항",
  "개정",
  "신설",
  "삭제",
  "본교",
  "고려대학교",
  "위원회",
  "대학",
  "대학원",
  "학생",
]);

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  const count = toPositiveInt(args.count, DEFAULT_COUNT);
  const searchLimit = toPositiveInt(args.searchLimit, DEFAULT_SEARCH_LIMIT);
  const aiLimit = toPositiveInt(args.aiLimit, DEFAULT_AI_LIMIT);
  const minPassRate = toFiniteNumber(args.minPassRate, DEFAULT_MIN_PASS_RATE);
  const style = normalizeStyle(args.style ?? (args.complex === "true" ? "complex" : DEFAULT_STYLE));
  const seed = toPositiveInt(args.seed, DEFAULT_SEED);
  const dbPath = args.db ?? defaultDbPath();
  const outputPath =
    args.output ??
    path.join(process.cwd(), "reports", `local-search-eval-${style}-${count}-${new Date().toISOString().slice(0, 10)}.json`);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Local policy DB not found: ${dbPath}`);
  }

  const sourceDb = new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true });
  const articles = listCandidateArticles(sourceDb);
  sourceDb.close();
  if (articles.length === 0) throw new Error("No candidate articles found in local DB.");

  const questions = generateQuestions(articles, count, style, seed);
  if (questions.length < count) {
    throw new Error(`Only generated ${questions.length} questions from local DB; expected ${count}.`);
  }

  const appDb = new DatabaseService(dbPath);
  const search = new SearchService(appDb);
  const results = questions.map((question) => evaluateQuestion(search, question, searchLimit, aiLimit));
  appDb.close();

  const summary = summarize(results);
  const report = {
    generatedAt: new Date().toISOString(),
    dbPath,
    count: questions.length,
    style,
    seed,
    searchLimit,
    aiLimit,
    minPassRate,
    summary,
    failures: results.filter((result) => !result.passed),
    questions: results,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  printSummary(summary, outputPath);
  if (summary.passRate < minPassRate) {
    process.exitCode = 1;
  }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = "true";
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function defaultDbPath() {
  if (process.env.KU_POLICY_DB) return process.env.KU_POLICY_DB;
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is not set. Pass --db <path>.");
  return path.join(appData, "KU Regulation Searcher", "data", "ku-policy.sqlite");
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStyle(value) {
  if (value === "complex" || value === "standard") return value;
  throw new Error(`Unsupported --style: ${value}. Use standard or complex.`);
}

function listCandidateArticles(db) {
  return db
    .prepare(
      `SELECT id, regulation_id, regulation_name, article_no, article_title, article_body,
              seq, seq_history, seq_contents, source_url, fetched_at
       FROM articles
       WHERE LENGTH(TRIM(article_body)) >= 20
         AND article_body NOT LIKE '%<삭제%'
         AND article_no NOT IN ('원문', '별표/서식')
         AND COALESCE(article_title, '') NOT IN ('원문 파일', '별표/서식')
         AND TRIM(article_no) != ''
       ORDER BY regulation_name ASC, seq_contents ASC, id ASC`,
    )
    .all()
    .filter((article) => !isGenericTitle(article.article_title) || article.article_body.length >= 80);
}

function generateQuestions(articles, count, style = DEFAULT_STYLE, seed = DEFAULT_SEED) {
  if (style === "complex") return generateComplexQuestions(articles, count, seed);
  return generateStandardQuestions(articles, count);
}

function generateStandardQuestions(articles, count) {
  const pools = {
    article_lookup: articles.filter(hasUsefulArticleNo),
    title_lookup: articles.filter(hasUsefulTitle),
    procedure: articles.filter((article) => hasUsefulTitle(article) && PROCEDURE_TITLE.test(cleanTitle(article.article_title))),
    duration: articles.filter((article) => hasUsefulTitle(article) && DURATION_TITLE.test(cleanTitle(article.article_title))),
    eligibility: articles.filter((article) => hasUsefulTitle(article) && ELIGIBILITY_TITLE.test(cleanTitle(article.article_title))),
    amount: articles.filter((article) => hasUsefulTitle(article) && AMOUNT_TITLE.test(cleanTitle(article.article_title))),
  };

  const questions = [];
  const used = new Set();
  for (const [category, target] of Object.entries(categoryTargets(count, CATEGORY_WEIGHTS))) {
    addFromPool(questions, used, category, pools[category], Math.min(target, count - questions.length));
  }
  for (const category of Object.keys(pools)) {
    if (questions.length >= count) break;
    addFromPool(questions, used, category, pools[category], count - questions.length);
  }
  return questions.slice(0, count).map((question, index) => ({ ...question, no: index + 1 }));
}

function generateComplexQuestions(articles, count, seed) {
  const rng = createRng(seed);
  const usefulTitles = articles.filter(hasUsefulTitle);
  const pools = {
    article_lookup: articles.filter(hasUsefulArticleNo),
    title_lookup: usefulTitles,
    procedure: usefulTitles.filter((article) => PROCEDURE_TITLE.test(cleanTitle(article.article_title))),
    duration: usefulTitles.filter((article) => DURATION_TITLE.test(cleanTitle(article.article_title))),
    eligibility: usefulTitles.filter((article) => ELIGIBILITY_TITLE.test(cleanTitle(article.article_title))),
    amount: usefulTitles.filter((article) => AMOUNT_TITLE.test(cleanTitle(article.article_title))),
    evidence_check: usefulTitles.filter((article) => pickBodyHint(article)),
    exception_check: usefulTitles.filter((article) => EXCEPTION_BODY.test(article.article_body)),
  };

  const questions = [];
  const used = new Set();
  for (const [category, target] of Object.entries(categoryTargets(count, COMPLEX_CATEGORY_WEIGHTS))) {
    addComplexFromPool(questions, used, category, pools[category], Math.min(target, count - questions.length), rng);
  }
  for (const category of Object.keys(pools)) {
    if (questions.length >= count) break;
    addComplexFromPool(questions, used, category, pools[category], count - questions.length, rng);
  }
  return questions.slice(0, count).map((question, index) => ({ ...question, no: index + 1 }));
}

function categoryTargets(count, weights) {
  const baseTotal = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const targets = {};
  let assigned = 0;
  for (const [category, weight] of Object.entries(weights)) {
    const target = Math.floor((count * weight) / baseTotal);
    targets[category] = target;
    assigned += target;
  }
  const categories = Object.keys(weights);
  let index = 0;
  while (assigned < count) {
    targets[categories[index % categories.length]] += 1;
    assigned += 1;
    index += 1;
  }
  return targets;
}

function addFromPool(questions, used, category, pool, target) {
  const ordered = pickDiverse(pool);
  let added = 0;
  for (const article of ordered) {
    if (target <= 0) return;
    const key = `${category}:${article.id}`;
    if (used.has(key)) continue;
    const question = buildQuestion(category, article);
    if (!question) continue;
    used.add(key);
    questions.push(question);
    added += 1;
    if (added >= target) return;
  }
}

function addComplexFromPool(questions, used, category, pool, target, rng) {
  const ordered = shuffleDeterministic(pickDiverse(pool), rng);
  let added = 0;
  for (const article of ordered) {
    if (target <= 0) return;
    const key = `${category}:${article.id}`;
    if (used.has(key)) continue;
    const question = buildComplexQuestion(category, article, rng);
    if (!question) continue;
    used.add(key);
    questions.push(question);
    added += 1;
    if (added >= target) return;
  }
}

function pickDiverse(pool) {
  const buckets = new Map();
  for (const article of pool) {
    const bucket = buckets.get(article.regulation_name) ?? [];
    bucket.push(article);
    buckets.set(article.regulation_name, bucket);
  }
  const names = Array.from(buckets.keys()).sort();
  const selected = [];
  let index = 0;
  while (selected.length < pool.length) {
    let added = false;
    for (const name of names) {
      const article = buckets.get(name)[index];
      if (article) {
        selected.push(article);
        added = true;
      }
    }
    if (!added) break;
    index += 1;
  }
  return selected;
}

function buildQuestion(category, article) {
  const title = cleanTitle(article.article_title);
  const regulation = article.regulation_name;
  const topic = title || article.article_no;
  const expected = {
    expectedArticleId: article.id,
    expectedRegulationName: regulation,
    expectedArticleNo: article.article_no,
    expectedTitle: article.article_title,
  };

  switch (category) {
    case "article_lookup":
      return { category, question: `${regulation} ${article.article_no} 조항 내용 알려줘`, ...expected };
    case "title_lookup":
      if (!title) return null;
      return { category, question: `${regulation}의 ${title} 규정은?`, ...expected };
    case "procedure":
      return { category, question: `${regulation}에서 ${topic}은 어떻게 하나요?`, ...expected };
    case "duration":
      return { category, question: `${regulation}의 ${topic} 기간은?`, ...expected };
    case "eligibility":
      return { category, question: `${regulation}의 ${topic} 대상이나 요건은?`, ...expected };
    case "amount":
      return { category, question: `${regulation}의 ${topic} 지급 기준이나 금액은?`, ...expected };
    default:
      return null;
  }
}

function buildComplexQuestion(category, article, rng) {
  const title = cleanTitle(article.article_title);
  const regulation = cleanRegulationName(article.regulation_name);
  const topic = title || article.article_no;
  const hint = pickBodyHint(article);
  const expected = {
    expectedArticleId: article.id,
    expectedRegulationName: article.regulation_name,
    expectedArticleNo: article.article_no,
    expectedTitle: article.article_title,
  };

  const variants = {
    article_lookup: [
      `${regulation}에서 ${article.article_no} 조항이 실제로 무슨 내용인지 근거까지 같이 정리해줘.`,
      `${regulation} ${article.article_no}를 봐야 할 것 같은데, 핵심 내용과 적용할 때 볼 부분을 알려줘.`,
      `혹시 ${regulation}의 ${article.article_no} 조항을 기준으로 답해야 하는 사안이면, 해당 조문 내용을 찾아줘.`,
      `${regulation} ${article.article_no}에 나온 기준을 짧게 요약하고 조항명도 같이 확인해줘.`,
    ],
    title_lookup: [
      `${regulation} 관련해서 ${topic} 부분을 찾고 있는데, 어느 조항이고 뭐라고 되어 있는지 알려줘.`,
      `${regulation}의 ${topic} 조항을 근거로 내용을 확인해줘.`,
      `${topic}에 대해 답하려면 ${regulation}에서 어떤 조항을 봐야 해?`,
      `${regulation} 안에서 ${topic}이라는 제목의 조항 내용을 간단히 정리해줘.`,
    ],
    procedure: [
      `${regulation} 기준으로 ${topic}을 처리하려면 누가 무엇을 신청하거나 제출해야 하는지 알려줘.`,
      `${topic} 절차가 궁금해. ${regulation}에서 신청, 승인, 제출 같은 절차 근거를 찾아줘.`,
      `${regulation}의 ${topic} 관련해서 실제 업무 흐름을 설명할 수 있는 조항을 찾아줘.`,
      `${topic}을 진행할 때 필요한 서류나 허가가 있으면 ${regulation} 근거로 정리해줘.`,
    ],
    duration: [
      `${regulation}에서 ${topic}과 관련된 기간, 기한, 학기 수가 어떻게 정해져 있는지 알려줘.`,
      `${topic}은 언제까지 또는 몇 학기까지 가능한지 ${regulation} 근거로 답해줘.`,
      `${regulation} 기준으로 ${topic}의 통산 기간이나 제한 기간을 확인해줘.`,
      `${topic} 관련 기간 규정이 헷갈리는데, ${regulation}에서 정한 기준을 찾아줘.`,
    ],
    eligibility: [
      `${regulation} 기준으로 ${topic}의 대상자나 자격 요건이 어떻게 되는지 알려줘.`,
      `${topic}이 누구에게 적용되는지 ${regulation} 근거 조항으로 확인해줘.`,
      `${topic}에 해당하려면 어떤 요건을 갖춰야 하는지 ${regulation}에서 찾아줘.`,
      `${regulation}의 ${topic} 관련 대상, 제한, 조건을 한 번에 정리해줘.`,
    ],
    amount: [
      `${regulation}에서 ${topic} 관련 지급액, 금액, 부담 기준이 있으면 찾아서 알려줘.`,
      `${topic} 금액이나 지원 기준을 ${regulation} 근거로 확인해줘.`,
      `${regulation} 기준으로 ${topic}의 지급, 감면, 수업료 같은 돈 관련 기준을 알려줘.`,
      `${topic}에 대해 실제로 얼마를 지급하거나 부담하는지 ${regulation} 조항으로 찾아줘.`,
    ],
    evidence_check: [
      `${regulation}에서 ${topic}을 볼 때 ${hint}라는 표현이 같이 나오던데, 해당 조항 근거를 확인해줘.`,
      `${hint} 내용과 연결되는 ${topic} 조항을 ${regulation}에서 찾아서 답해줘.`,
      `${regulation} 관련 답변을 해야 하는데 ${topic}과 ${hint}가 같이 나오는 조항을 근거로 정리해줘.`,
      `${topic} 조항 중 ${hint} 부분이 핵심인 것 같아. ${regulation}에서 정확한 조항을 찾아줘.`,
    ],
    exception_check: [
      `${regulation}의 ${topic}에는 예외나 제한이 있는지, 다만이나 제외되는 경우까지 같이 확인해줘.`,
      `${topic} 기준을 볼 때 포함되지 않는 경우나 예외가 있는지 ${regulation} 근거로 알려줘.`,
      `${regulation}에서 ${topic} 관련 제한, 연장, 면제 같은 예외 조항을 같이 찾아줘.`,
      `${topic}은 원칙만 보면 안 될 것 같은데 ${regulation}에서 예외 조건까지 정리해줘.`,
    ],
  };

  const options = variants[category] ?? [];
  if (options.length === 0) return null;
  if ((category === "evidence_check" || category === "exception_check") && (!title || !hint)) return null;
  const question = options[Math.floor(rng() * options.length)];
  return { category, question, ...expected };
}

function evaluateQuestion(search, question, searchLimit, aiLimit) {
  const result = search.searchForQuestion(question.question, searchLimit);
  const evidence = pickDefaultAiEvidence(result.articles, aiLimit);
  const evidenceIds = new Set(evidence.map((article) => article.id));
  const exactExpectedFound = evidenceIds.has(question.expectedArticleId);
  const sameArticleFound = evidence.some(
    (article) =>
      article.regulation_name === question.expectedRegulationName &&
      article.article_no === question.expectedArticleNo,
  );
  const sameTitleFound = evidence.some(
    (article) =>
      article.regulation_name === question.expectedRegulationName &&
      compactText(article.article_title) === compactText(question.expectedTitle),
  );
  const hasAnswerEvidence = evidence.length > 0;
  const top = result.articles[0] ?? null;
  const passed = hasAnswerEvidence && (exactExpectedFound || sameArticleFound || sameTitleFound);

  return {
    ...question,
    passed,
    reason: passed
      ? "expected_evidence_selected"
      : hasAnswerEvidence
        ? "expected_evidence_missing"
        : result.errorCode ?? "no_default_ai_evidence",
    expandedKeywords: result.expandedKeywords,
    searchedCandidateCount: result.searchedCandidateCount,
    candidateLimitReached: result.candidateLimitReached ?? false,
    defaultEvidenceCount: evidence.length,
    defaultEvidenceIds: evidence.map((article) => article.id),
    topArticle: top
      ? {
          id: top.id,
          regulationName: top.regulation_name,
          articleNo: top.article_no,
          title: top.article_title,
          relevance: top.relevance,
        }
      : null,
    evidencePreview: evidence.slice(0, 5).map((article) => ({
      id: article.id,
      regulationName: article.regulation_name,
      articleNo: article.article_no,
      title: article.article_title,
      relevance: article.relevance,
    })),
  };
}

function pickDefaultAiEvidence(articles, maxCount) {
  const primary = articles.filter((article) => article.relevance?.group === "primary");
  const related = articles.filter((article) => article.relevance?.group === "related");
  if (primary.length > 0) return primary.slice(0, maxCount);
  return related.slice(0, maxCount);
}

function summarize(results) {
  const categories = {};
  for (const result of results) {
    const bucket = categories[result.category] ?? { total: 0, passed: 0, failed: 0, passRate: 0 };
    bucket.total += 1;
    if (result.passed) bucket.passed += 1;
    else bucket.failed += 1;
    bucket.passRate = Number((bucket.passed / bucket.total).toFixed(4));
    categories[result.category] = bucket;
  }
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  return {
    total: results.length,
    passed,
    failed,
    passRate: Number((passed / Math.max(1, results.length)).toFixed(4)),
    categories,
    failureReasons: countBy(results.filter((result) => !result.passed).map((result) => result.reason)),
  };
}

function printSummary(summary, outputPath) {
  console.log(`Generated/evaluated: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Pass rate: ${(summary.passRate * 100).toFixed(2)}%`);
  console.log("By category:");
  for (const [category, result] of Object.entries(summary.categories)) {
    console.log(`  ${category}: ${result.passed}/${result.total} (${(result.passRate * 100).toFixed(2)}%)`);
  }
  console.log(`Report: ${outputPath}`);
}

function countBy(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function hasUsefulArticleNo(article) {
  return /제\s*\d|^[0-9]/u.test(article.article_no);
}

function hasUsefulTitle(article) {
  const title = cleanTitle(article.article_title);
  return title.length >= 2 && !isGenericTitle(title);
}

function isGenericTitle(value) {
  const title = cleanTitle(value);
  return !title || GENERIC_TITLES.has(title) || /^삭제/u.test(title);
}

function cleanTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRegulationName(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function searchableTitle(article) {
  return `${cleanTitle(article.article_title)} ${article.article_body}`;
}

function pickBodyHint(article) {
  const titleTokens = new Set(
    cleanTitle(article.article_title)
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter(Boolean),
  );
  const body = String(article.article_body ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[①-⑳]/gu, " ")
    .replace(/\d+\.\s*/g, " ")
    .replace(/\s+/g, " ");
  const candidates = [];
  for (const match of body.matchAll(/[가-힣A-Za-z0-9·ㆍ-]{2,16}/gu)) {
    const value = match[0].replace(/[·ㆍ-]+$/u, "").trim();
    const compactValue = compactText(value);
    if (compactValue.length < 2 || compactValue.length > 16) continue;
    if (BODY_HINT_STOP_WORDS.has(compactValue)) continue;
    if (/^\d+$/u.test(compactValue)) continue;
    if (/^(제\d+조|별지|별표|항|호)$/u.test(compactValue)) continue;
    if (titleTokens.has(value) && value.length <= 3) continue;
    candidates.push(value);
  }
  const ranked = Array.from(new Set(candidates)).sort((a, b) => {
    const aScore = hintScore(a, article);
    const bScore = hintScore(b, article);
    return bScore - aScore || b.length - a.length || a.localeCompare(b, "ko");
  });
  return ranked[0] ?? null;
}

function hintScore(value, article) {
  let score = 0;
  if (/[가-힣]/u.test(value)) score += 20;
  if (value.length >= 4) score += 8;
  if (value.length >= 7) score += 4;
  if (cleanTitle(article.article_title).includes(value)) score += 12;
  if (/(신청|제출|승인|허가|기간|대상|자격|요건|금액|지급|휴학|복학|자퇴|등록|장학|수업료)/u.test(value)) {
    score += 16;
  }
  return score;
}

function compactText(value) {
  return cleanTitle(value).replace(/[\s"'‘’“”`.,;:()[\]{}<>〈〉《》「」『』·ㆍ\-_/\\]/g, "").toLowerCase();
}

function searchable(article) {
  return `${article.regulation_name} ${article.article_title ?? ""} ${article.article_body}`;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleDeterministic(values, rng) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
