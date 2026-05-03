const fs = require("node:fs");
const path = require("node:path");
const BetterSqlite3 = require("better-sqlite3");
const { DatabaseService } = require("../dist/main/db/database.js");
const { SearchService } = require("../dist/main/search/fts-search.js");

const DEFAULT_COUNT = 5000;
const DEFAULT_SEARCH_LIMIT = 30;
const DEFAULT_AI_LIMIT = 12;
const DEFAULT_MIN_PASS_RATE = 0.92;

const CATEGORY_WEIGHTS = {
  article_lookup: 90,
  title_lookup: 120,
  procedure: 95,
  duration: 95,
  eligibility: 70,
  amount: 30,
};

const GENERIC_TITLES = new Set(["목적", "정의", "용어의 정의", "부칙", "시행일", "적용범위", "삭제"]);
const PROCEDURE_TITLE = /신청|제출|승인|허가|절차|원서|접수|신고|심의|선정|임명|반납|취소|변경|등록/u;
const DURATION_TITLE = /기간|기한|학기|연한|시기|일수|기일|유효기간|제출기한|신청기간/u;
const ELIGIBILITY_TITLE = /대상|자격|요건|조건|선발기준|선발|지원자격|제한|기준|요건/u;
const AMOUNT_TITLE = /장학금액|금액|지급|등록금|수업료|수당|급여|지원비|연구비|감면|대관료|사용료/u;

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  const count = toPositiveInt(args.count, DEFAULT_COUNT);
  const searchLimit = toPositiveInt(args.searchLimit, DEFAULT_SEARCH_LIMIT);
  const aiLimit = toPositiveInt(args.aiLimit, DEFAULT_AI_LIMIT);
  const minPassRate = toFiniteNumber(args.minPassRate, DEFAULT_MIN_PASS_RATE);
  const dbPath = args.db ?? defaultDbPath();
  const outputPath = args.output ?? path.join(process.cwd(), "reports", `local-search-eval-${new Date().toISOString().slice(0, 10)}.json`);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Local policy DB not found: ${dbPath}`);
  }

  const sourceDb = new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true });
  const articles = listCandidateArticles(sourceDb);
  sourceDb.close();
  if (articles.length === 0) throw new Error("No candidate articles found in local DB.");

  const questions = generateQuestions(articles, count);
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

function generateQuestions(articles, count) {
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
  for (const [category, target] of Object.entries(categoryTargets(count))) {
    addFromPool(questions, used, category, pools[category], Math.min(target, count - questions.length));
  }
  for (const category of Object.keys(pools)) {
    if (questions.length >= count) break;
    addFromPool(questions, used, category, pools[category], count - questions.length);
  }
  return questions.slice(0, count).map((question, index) => ({ ...question, no: index + 1 }));
}

function categoryTargets(count) {
  const baseTotal = Object.values(CATEGORY_WEIGHTS).reduce((sum, value) => sum + value, 0);
  const targets = {};
  let assigned = 0;
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const target = Math.floor((count * weight) / baseTotal);
    targets[category] = target;
    assigned += target;
  }
  const categories = Object.keys(CATEGORY_WEIGHTS);
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

function compactText(value) {
  return cleanTitle(value).replace(/[\s"'‘’“”`.,;:()[\]{}<>〈〉《》「」『』·ㆍ\-_/\\]/g, "").toLowerCase();
}

function searchable(article) {
  return `${article.regulation_name} ${article.article_title ?? ""} ${article.article_body}`;
}
