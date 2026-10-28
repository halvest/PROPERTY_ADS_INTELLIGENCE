import { describe, it, expect, vi } from "vitest";
import { MetaModelApiClient } from "@/lib/ai/meta/client";
import { AIProviderError } from "@/lib/ai/providers/types";

describe("MetaModelApiClient", () => {
  const dummyApiKey = "meta_test_secret_key_8888";
  const dummyBaseUrl = "https://api.meta.ai/v1";

  it("throws MISSING_CONFIGURATION when API key is empty", async () => {
    const client = new MetaModelApiClient({ apiKey: "", baseUrl: dummyBaseUrl });

    await expect(
      client.createChatCompletion({
        messages: [{ role: "user", content: "Halo" }],
      })
    ).rejects.toThrow(AIProviderError);
  });

  it("sends correct headers, endpoint, and payload to Meta Model API", async () => {
    interface CapturedPayload {
      model?: string;
      temperature?: number;
      response_format?: { type: string };
      messages?: Array<{ role: string; content: string }>;
    }

    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: CapturedPayload | null = null;

    const mockFetch = vi.fn().mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      capturedBody = init?.body ? (JSON.parse(init.body as string) as CapturedPayload) : null;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "chatcmpl-mock-123",
          model: "muse-spark-1.3",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"status":"ok"}' },
              finish_reason: "stop",
            },
          ],
        }),
      };
    });

    const client = new MetaModelApiClient({
      apiKey: dummyApiKey,
      baseUrl: dummyBaseUrl,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const response = await client.createChatCompletion({
      messages: [{ role: "user", content: "Halo properti" }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    expect(capturedUrl).toBe("https://api.meta.ai/v1/chat/completions");
    expect(capturedHeaders["Authorization"]).toBe(`Bearer ${dummyApiKey}`);
    const body = capturedBody as CapturedPayload | null;
    expect(body?.model).toBe("muse-spark-1.3");
    expect(body?.temperature).toBe(0.1);
    expect(body?.response_format).toEqual({ type: "json_object" });

    expect(response.choices[0].message.content).toBe('{"status":"ok"}');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("handles 401 Unauthorized immediately without blind retries", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => `{"error":{"message":"Invalid API key: ${dummyApiKey}"}}`,
    });

    const client = new MetaModelApiClient({
      apiKey: dummyApiKey,
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 3,
    });

    await expect(
      client.createChatCompletion({
        messages: [{ role: "user", content: "Test auth" }],
      })
    ).rejects.toThrowError(AIProviderError);

    // Must NOT retry 401
    expect(mockFetch).toHaveBeenCalledTimes(1);

    try {
      await client.createChatCompletion({
        messages: [{ role: "user", content: "Test auth" }],
      });
    } catch (err) {
      const providerErr = err as AIProviderError;
      expect(providerErr.code).toBe("AUTHENTICATION_ERROR");
      expect(providerErr.isRecoverable).toBe(false);
      // Key must be sanitized from error output
      expect(providerErr.message).not.toContain(dummyApiKey);
      expect(providerErr.message).toContain("[REDACTED_API_KEY]");
    }
  });

  it("retries on 429 Rate Limit with bounded backoff and succeeds on retry", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded. Please slow down.",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "retry-success",
          model: "muse-spark-1.3",
          choices: [{ index: 0, message: { role: "assistant", content: "{}" }, finish_reason: "stop" }],
        }),
      };
    });

    const client = new MetaModelApiClient({
      apiKey: dummyApiKey,
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 2,
    });

    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "Test retry" }],
    });

    expect(callCount).toBe(2);
    expect(result.id).toBe("retry-success");
  });

  it("throws RATE_LIMIT_ERROR when max retries are exhausted", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    });

    const client = new MetaModelApiClient({
      apiKey: dummyApiKey,
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 1,
    });

    try {
      await client.createChatCompletion({
        messages: [{ role: "user", content: "Rate limit test" }],
      });
      expect.unreachable("Should have thrown");
    } catch (err) {
      const providerErr = err as AIProviderError;
      expect(providerErr.code).toBe("RATE_LIMIT_ERROR");
      expect(providerErr.statusCode).toBe(429);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    }
  });

  it("handles request timeouts cleanly using AbortController", async () => {
    const mockFetch = vi.fn().mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    const client = new MetaModelApiClient({
      apiKey: dummyApiKey,
      fetchFn: mockFetch as unknown as typeof fetch,
      timeoutMs: 50, // fast timeout for test
      maxRetries: 0,
    });

    try {
      await client.createChatCompletion({
        messages: [{ role: "user", content: "Timeout test" }],
      });
      expect.unreachable("Should have timed out");
    } catch (err) {
      const providerErr = err as AIProviderError;
      expect(providerErr).toBeInstanceOf(AIProviderError);
      expect(providerErr.code).toBe("TIMEOUT_ERROR");
      expect(providerErr.message).toContain("timed out");
      expect(providerErr.isRecoverable).toBe(true);
    }
  });
});
