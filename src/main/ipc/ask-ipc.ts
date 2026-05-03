import { ipcMain } from "electron";
import type { GenerateAnswerRequest, SearchArticlesRequest } from "../../shared/types";
import type { IpcContext } from "./types";
import type { IpcHandlerWrap } from "./wrap";

export function registerAskIpc(context: IpcContext, wrap: IpcHandlerWrap): void {
  ipcMain.handle("ask:search", async (_event, request: SearchArticlesRequest) =>
    wrap(() =>
      context.searchService.searchForQuestion(
        request.query,
        request.limit ?? context.settingsStore.getRagSettings().searchCandidateLimit,
      ),
    ),
  );
  ipcMain.handle("ask:generate", async (_event, request: GenerateAnswerRequest) =>
    wrap(async () => {
      const articles = context.searchService.getCandidateArticles(
        request.articleIds,
        context.settingsStore.getRagSettings().maxCandidateLimit,
      );
      const answer = await context.geminiClient.generateAnswer({
        apiKey: context.apiKeyStore.load(),
        modelId: context.settingsStore.getModelId(),
        question: request.question,
        articles,
      });
      context.settingsStore.addUsage(answer.usage ?? {});
      return answer;
    }),
  );
}
