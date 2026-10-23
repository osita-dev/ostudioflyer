// ─────────────────────────────────────────────────────────────────────────────
// useGeneration — wraps the S1–S7 pipeline in a TanStack Query mutation.
// Stage events drive the progress UI; errors surface with actionable hints.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GenerationError, runGeneration } from "@/domain/pipeline";
import { recentGists } from "@/domain/selectors";
import type { SubjectChoice } from "@/domain/selectors";
import type { ContentRecord, PipelineStage } from "@/domain/types";
import { callGenerate, ProxyError } from "@/services/proxy";

export interface StageInfo {
  stage: PipelineStage;
  detail?: string;
}

export interface GenErrorInfo {
  message: string;
  hint?: string;
}

function toErrorInfo(err: unknown): GenErrorInfo {
  if (err instanceof ProxyError) return { message: err.message, hint: err.hint };
  if (err instanceof GenerationError) {
    return {
      message:
        err.kind === "empty"
          ? "The library has no eligible subjects left."
          : err.kind === "rejected"
            ? "Generation kept missing the quality rules."
            : "Couldn't reach the generation service.",
      hint: err.message,
    };
  }
  if ((err as Error)?.name === "AbortError")
    return { message: "Cancelled.", hint: "Your previous draft is untouched." };
  return { message: "Something went wrong.", hint: (err as Error)?.message };
}

export function useGeneration() {
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);

  const mutation = useMutation({
    mutationFn: async (args: { pick: SubjectChoice; records: ContentRecord[] }) =>
      runGeneration({
        records: args.records,
        pick: args.pick,
        generate: callGenerate,
        onStage: (stage, detail) => setStageInfo({ stage, detail }),
      }),
  });

  const start = useCallback(
    (pick: SubjectChoice, records: ContentRecord[]) => {
      setStageInfo(null);
      mutation.mutate({ pick, records });
    },
    [mutation]
  );

  const reset = useCallback(() => {
    setStageInfo(null);
    mutation.reset();
  }, [mutation]);

  return {
    start,
    reset,
    isPending: mutation.isPending,
    record: mutation.data ?? null,
    // useMemo keeps error identity stable → the toast effect fires once.
    error: useMemo(
      () => (mutation.isError ? toErrorInfo(mutation.error) : null),
      [mutation.isError, mutation.error]
    ),
    stageInfo,
    /** S1 input — exposed so the UI can show "30 gists loaded" honestly */
    gistCount: (records: ContentRecord[]) => recentGists(records).length,
  };
}
