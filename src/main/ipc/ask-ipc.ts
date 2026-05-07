import { ipcMain } from "electron";
import type { GenerateAnswerRequest, SearchArticlesRequest } from "../../shared/types";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";
import { isNonKoreanLanguage, resolveQueryLanguage } from "../search/query-language";

export function registerAskIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("ask:search", async (_event, request: SearchArticlesRequest) =>
    wrap(async () => {
      const detectedLanguage = resolveQueryLanguage(request.query, request.language);
      const aiNormalizedQueries: string[] = [];
      const normalizationNotes: string[] = [];

      if (isNonKoreanLanguage(detectedLanguage)) {
        try {
          const normalized = await context.geminiClient.normalizeSearchQuery({
            apiKey: context.apiKeyStore.load(),
            modelId: context.settingsStore.getModelId(),
            question: request.query,
            language: detectedLanguage,
          });
          aiNormalizedQueries.push(...normalized.queries);
          context.settingsStore.addUsage(normalized.usage);
        } catch {
          normalizationNotes.push("AI 검색 정규화를 사용할 수 없어 로컬 다국어 용어집만 사용했습니다.");
        }
      }

      const result = context.searchService.searchForQuestion(
        request.query,
        request.limit ?? context.settingsStore.getRagSettings().searchCandidateLimit,
        {
          group: request.group ?? request.scope,
          campus: request.campus,
          language: request.language,
          normalizedQueries: aiNormalizedQueries,
          includeCustomRules: request.includeCustomRules,
        },
      );
      if (normalizationNotes.length > 0) {
        result.routingNotes = [...normalizationNotes, ...(result.routingNotes ?? [])].slice(0, 4);
      }
      return result;
    }),
  );
  ipcMain.handle("ask:generate", async (_event, request: GenerateAnswerRequest) =>
    wrap(async () => {
      const ragSettings = context.settingsStore.getRagSettings();
      const articles = context.searchService.getCandidateArticles(
        request.articleIds,
        ragSettings.maxCandidateLimit,
      );
      const answer = await context.geminiClient.generateAnswer({
        apiKey: context.apiKeyStore.load(),
        modelId: context.settingsStore.getModelId(),
        question: request.question,
        articles,
        group: request.group ?? request.scope,
        campus: request.campus,
        language: request.language,
        detectedLanguage: request.detectedLanguage,
        includeCustomRules: request.includeCustomRules,
      });
      if (request.articleIds.length > articles.length) {
        answer.warnings.unshift(
          `선택한 근거 조항 ${request.articleIds.length}개 중 AI에는 최대 ${articles.length}개만 전달되었습니다.`,
        );
      }
      if (request.articleIds.length >= ragSettings.searchCandidateLimit) {
        answer.warnings.unshift(
          `검색 후보가 설정 한도(${ragSettings.searchCandidateLimit}개)에 도달했습니다. 관련 조항이 더 있을 수 있으므로 필요하면 검색 후보 수를 늘리거나 소속/대학원/학과를 좁혀 다시 검색하세요.`,
        );
      }
      context.settingsStore.addUsage(answer.usage ?? {});
      return answer;
    }),
  );
}
