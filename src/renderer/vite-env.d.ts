/// <reference types="vite/client" />

import type { KuRegulationApi } from "../shared/api";

declare global {
  interface Window {
    kuRegulation: KuRegulationApi;
  }
}
