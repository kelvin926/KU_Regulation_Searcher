import type { DetectedQueryLanguage } from "../../shared/types";

const MAX_LOCAL_VARIANTS = 8;

interface GlossaryRule {
  patterns: Array<string | RegExp>;
  terms: string[];
}

const GLOSSARY_RULES: GlossaryRule[] = [
  {
    patterns: [/\bundergraduate\b/u, /\bbachelor\b/u, /\bfreshman\b/u, /\bfirst-year\b/u, /本科/u, /本科生/u, /学部/u, /學部/u],
    terms: ["학부", "학부생", "학사운영", "학칙"],
  },
  {
    patterns: [/\bgraduate student\b/u, /\bgraduate school\b/u, /\bgraduate\b/u, /\bmaster\b/u, /\bdoctoral\b/u, /\bphd\b/u, /研究生/u, /研究所/u, /硕士/u, /碩士/u, /博士/u],
    terms: ["대학원", "일반대학원", "대학원학칙", "일반대학원 시행세칙"],
  },
  {
    patterns: [/professional graduate/u, /special graduate/u, /law school/u, /business school/u, /专业研究生院/u, /專業研究生院/u, /特殊研究生院/u, /法科/u],
    terms: ["전문대학원", "특수대학원", "법학전문대학원", "경영전문대학원", "시행세칙"],
  },
  {
    patterns: [/faculty/u, /professor/u, /newly appointed/u, /new faculty/u, /新任/u, /教授/u, /教员/u, /教員/u],
    terms: ["교원", "교수", "신임교원"],
  },
  {
    patterns: [/staff/u, /assistant/u, /employee/u, /职员/u, /職員/u, /助教/u],
    terms: ["직원", "조교", "직원인사", "조교임용"],
  },
  {
    patterns: [/leave of absence/u, /leave/u, /absence/u, /休学/u, /休學/u],
    terms: ["휴학", "일반휴학", "휴학기간", "휴학연한"],
  },
  {
    patterns: [/ordinary leave/u, /general leave/u, /regular leave/u, /普通休学/u, /普通休學/u, /一般休学/u, /一般休學/u],
    terms: ["일반휴학", "휴학", "휴학기간", "휴학의 신청"],
  },
  {
    patterns: [/military leave/u, /military service/u, /enlistment/u, /conscription/u, /army/u, /兵役/u, /服兵役/u, /入伍/u, /军休学/u, /軍休學/u],
    terms: ["군입대", "군입대휴학", "군복무", "병역", "입영", "소집", "입영통지서", "휴학"],
  },
  {
    patterns: [/return to school/u, /reinstatement/u, /復学/u, /复学/u, /復學/u],
    terms: ["복학", "복학신청", "군제대복학"],
  },
  {
    patterns: [/withdraw/u, /withdrawal/u, /drop out/u, /退学/u, /退學/u],
    terms: ["자퇴", "자퇴원", "퇴학", "제적", "제적 허가"],
  },
  {
    patterns: [/scholarship/u, /financial aid/u, /奖学金/u, /獎學金/u],
    terms: ["장학금", "장학", "지급대상", "신청서류"],
  },
  {
    patterns: [/tuition/u, /registration fee/u, /fee/u, /学费/u, /學費/u, /注册金/u, /註冊金/u],
    terms: ["등록금", "수업료", "납입금", "학비", "감면"],
  },
  {
    patterns: [/course registration/u, /enroll in course/u, /class registration/u, /选课/u, /選課/u, /课程申请/u, /課程申請/u],
    terms: ["수강신청", "수강신청정정", "수강정정", "정정원서"],
  },
  {
    patterns: [/credit/u, /graduation/u, /completion/u, /毕业/u, /畢業/u, /学分/u, /學分/u],
    terms: ["학점", "이수", "졸업", "수료", "학위수여"],
  },
  {
    patterns: [/thesis/u, /dissertation/u, /advisor/u, /supervisor/u, /论文/u, /論文/u, /导师/u, /導師/u, /指导教授/u, /指導教授/u],
    terms: ["학위청구논문", "논문심사", "논문제출", "지도교수", "논문지도교수"],
  },
  {
    patterns: [/advisor change/u, /change advisor/u, /更换导师/u, /更換導師/u, /变更导师/u, /變更導師/u],
    terms: ["지도교수변경", "지도교수", "논문지도교수변경", "변경"],
  },
  {
    patterns: [/english lecture/u, /english-taught/u, /english course/u, /english class/u, /英语授课/u, /英語授課/u, /英语课/u, /英語課/u],
    terms: ["영어강의", "영강", "외국어강의", "외국어강좌"],
  },
  {
    patterns: [/teaching obligation/u, /teaching load/u, /required teaching/u, /obligation/u, /义务/u, /義務/u, /责任授课/u, /責任授課/u],
    terms: ["책임수업시간", "책임시수", "강의시수", "의무시수", "의무"],
  },
  {
    patterns: [/student council/u, /student association/u, /学生会/u, /學生會/u, /总学生会/u, /總學生會/u],
    terms: ["총학생회", "학생회칙", "학생자치", "학생자치단체"],
  },
  {
    patterns: [/seoul/u, /anam/u, /首尔/u, /首爾/u, /安岩/u],
    terms: ["서울", "서울캠퍼스", "안암", "안암캠퍼스"],
  },
  {
    patterns: [/sejong/u, /世宗/u],
    terms: ["세종", "세종캠퍼스"],
  },
  {
    patterns: [/rental/u, /rent/u, /borrow/u, /facility/u, /space/u, /대관/u, /대여/u, /租借/u, /借用/u, /场地/u, /場地/u],
    terms: ["대관", "대여", "사용", "공간대관", "시설대관", "사용신청"],
  },
  {
    patterns: [/future mobility/u, /smart mobility/u, /未来移动/u, /未來移動/u, /未来モビリティ/u],
    terms: ["미래모빌리티학과", "스마트모빌리티학부", "학부", "학사운영"],
  },
  {
    patterns: [/first semester/u, /first term/u, /right after admission/u, /immediately after admission/u, /入学后第一学期/u, /入學後第一學期/u, /刚入学/u, /剛入學/u],
    terms: ["신입생", "입학후첫학기", "첫학기", "휴학의제한", "휴학제한"],
  },
  {
    patterns: [/change/u, /switch/u, /convert/u, /cancel/u, /postpone/u, /转为/u, /轉為/u, /转换/u, /轉換/u, /取消/u, /延期/u],
    terms: ["변경", "정정", "전환", "취소", "철회", "연기", "사유 소멸"],
  },
  {
    patterns: [/procedure/u, /how can/u, /how do/u, /how should/u, /apply/u, /submit/u, /application/u, /怎么/u, /如何/u, /申请/u, /申請/u, /提交/u],
    terms: ["신청", "제출", "원서", "허가", "승인", "절차", "신청서류"],
  },
];

export function buildLocalKoreanQueryVariants(query: string, language: DetectedQueryLanguage): string[] {
  if (language === "ko") return [];

  const normalizedQuery = normalizeForMatch(query);
  const terms = new Set<string>();
  for (const rule of GLOSSARY_RULES) {
    if (!rule.patterns.some((pattern) => matchesPattern(normalizedQuery, pattern))) continue;
    for (const term of rule.terms) terms.add(term);
  }

  const variants = new Set<string>();
  addSpecializedVariants(variants, terms);
  if (variants.size === 0) {
    addVariant(variants, Array.from(terms).join(" "));
  }

  return Array.from(variants).slice(0, MAX_LOCAL_VARIANTS);
}

function addSpecializedVariants(variants: Set<string>, terms: Set<string>): void {
  const hasUndergraduateScope = hasAny(terms, ["학부", "미래모빌리티학과", "스마트모빌리티학부"]);
  const undergraduateScopePrefix = [
    ...["미래모빌리티학과", "스마트모빌리티학부"].filter((term) => terms.has(term)),
    ...(hasUndergraduateScope ? ["학부"] : []),
  ].join(" ");

  if (hasAny(terms, ["군입대", "군입대휴학"]) && hasAny(terms, ["신입생", "입학후첫학기"])) {
    const scopePrefix = hasUndergraduateScope ? `${undergraduateScopePrefix} ` : "";
    addVariant(variants, `${scopePrefix}학사운영 휴학의 제한 신입생 군입대 질병 재난 감염병 휴학`);
    addVariant(variants, `${scopePrefix}학사운영 군입대 휴학 신입생 입학후첫학기 휴학의제한 입영통지서`);
  }

  if (hasAny(terms, ["군입대", "군입대휴학"]) && hasAny(terms, ["전환", "취소", "사유 소멸", "일반휴학"])) {
    if (hasUndergraduateScope) {
      addVariant(variants, `${undergraduateScopePrefix} 학사운영 군입대 휴학 입영 소집 취소 연기 사유 소멸`);
      addVariant(variants, `${undergraduateScopePrefix} 학사운영 휴학의 분류 일반휴학 특별휴학 군입대`);
      addVariant(variants, `${undergraduateScopePrefix} 학사운영 특별휴학의 기간 군입대 일반휴학 의무복무기간`);
    }
    addVariant(variants, "학사운영 군입대 휴학 입영 소집 취소 연기 사유 소멸");
    addVariant(variants, "학사운영 휴학의 분류 일반휴학 특별휴학 군입대");
    addVariant(variants, "학사운영 특별휴학의 기간 군입대 일반휴학 의무복무기간");
  }

  if (hasAny(terms, ["자퇴", "자퇴원"]) && hasAny(terms, ["대학원", "일반대학원"])) {
    addVariant(variants, "일반대학원 시행세칙 자퇴 자퇴원");
    addVariant(variants, "대학원학칙 자퇴 제적 허가");
  }

  if (hasAny(terms, ["영어강의", "외국어강의"]) && hasAny(terms, ["신임교원", "책임수업시간", "의무"])) {
    addVariant(variants, "외국어강의에 관한 규정 영어강의 외국어강의");
    addVariant(variants, "신임교원 책임수업시간 감면 내규 영어강의 외국어강의");
    addVariant(variants, "교원 책임수업시간 외국어강의 영어강의 의무");
  }

  if (hasAny(terms, ["총학생회", "학생자치"]) && hasAny(terms, ["서울", "세종", "서울캠퍼스", "세종캠퍼스"])) {
    addVariant(variants, "서울 세종 총학생회 차이 학생자치 총학생회칙");
    addVariant(variants, "총학생회칙 안암총학생회 안암캠퍼스 회원 소재지 기구");
    addVariant(variants, "세종캠퍼스 총학생회 학생생활지원팀 총학생회 지원");
  }

  if (hasAny(terms, ["지도교수변경", "지도교수"]) && hasAny(terms, ["변경", "신청"])) {
    addVariant(variants, "일반대학원 지도교수 변경 정정 전환 신청 제출 원서 승인 절차");
  }
}

function normalizeForMatch(query: string): string {
  return query.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesPattern(query: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") return query.includes(pattern.toLowerCase());
  return pattern.test(query);
}

function hasAny(terms: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => terms.has(candidate));
}

function addVariant(variants: Set<string>, rawValue: string): void {
  const value = rawValue.replace(/\s+/g, " ").trim();
  if (value.length >= 2) variants.add(value);
}
