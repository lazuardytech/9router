const PROVIDERS_WITHOUT_SYSTEM_MESSAGE = new Set([
  "o1",
  "o1-mini",
  "o1-preview",
  "glm",
  "glmt",
  "glm-cn",
  "zai",
  "qianfan",
]);

export function providerSupportsSystemMessage(provider) {
  if (!provider) return true;
  return !PROVIDERS_WITHOUT_SYSTEM_MESSAGE.has(String(provider).toLowerCase().trim());
}

export function formatMemoryContext(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return "";
  const content = memories
    .map((m) => String(m?.content || "").trim())
    .filter(Boolean)
    .join("\n");
  return content ? `Memory context: ${content}` : "";
}

export function shouldInjectMemory(request, config = {}) {
  if (config.enabled === false) return false;
  return Array.isArray(request?.messages) && request.messages.length > 0;
}

export function injectMemory(request, memories, provider) {
  if (!Array.isArray(memories) || memories.length === 0) return request;
  const memoryText = formatMemoryContext(memories);
  if (!memoryText) return request;

  const messages = Array.isArray(request?.messages) ? [...request.messages] : [];
  if (providerSupportsSystemMessage(provider)) {
    return { ...request, messages: [{ role: "system", content: memoryText }, ...messages] };
  }
  return { ...request, messages: [{ role: "user", content: memoryText }, ...messages] };
}
