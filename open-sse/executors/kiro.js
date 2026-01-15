import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/constants.js";
import { v4 as uuidv4 } from "uuid";

/**
 * KiroExecutor - Executor for Kiro AI (AWS CodeWhisperer)
 * Uses AWS CodeWhisperer streaming API with AWS EventStream binary format
 */
export class KiroExecutor extends BaseExecutor {
  constructor() {
    super("kiro", PROVIDERS.kiro);
  }

  buildHeaders(credentials, stream = true) {
    const headers = {
      ...this.config.headers,
      "Amz-Sdk-Request": "attempt=1; max=3",
      "Amz-Sdk-Invocation-Id": uuidv4()
    };

    if (credentials.accessToken) {
      headers["Authorization"] = `Bearer ${credentials.accessToken}`;
    }

    return headers;
  }

  transformRequest(model, body, stream, credentials) {
    return body;
  }

  /**
   * Custom execute for Kiro - handles AWS EventStream binary response
   */
  async execute({ model, body, stream, credentials, signal, log }) {
    const url = this.buildUrl(model, stream, 0);
    const headers = this.buildHeaders(credentials, stream);
    const transformedBody = this.transformRequest(model, body, stream, credentials);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(transformedBody),
      signal
    });

    if (!response.ok) {
      return { response, url, headers, transformedBody };
    }

    // For Kiro, we need to transform the binary EventStream to SSE
    // Create a TransformStream to convert binary to SSE text
    const transformedResponse = this.transformEventStreamToSSE(response, model);
    
    return { response: transformedResponse, url, headers, transformedBody };
  }

  /**
   * Transform AWS EventStream binary response to SSE text stream
   */
  transformEventStreamToSSE(response, model) {
    const reader = response.body.getReader();
    let buffer = new Uint8Array(0);
    let chunkIndex = 0;
    const responseId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const state = {
      endDetected: false,
      finishEmitted: false,
      hasToolCalls: false,
      toolCallIndex: 0,
      seenToolIds: new Map() // Map toolUseId -> index
    };

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          
          if (done) {
            // Emit finish_reason chunk if not already sent
            if (!state.finishEmitted) {
              state.finishEmitted = true;
              const finishChunk = {
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: state.hasToolCalls ? "tool_calls" : "stop"
                }]
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
            }
            
            // Send final done message
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Append to buffer
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          // Parse events from buffer
          while (buffer.length >= 16) {
            const view = new DataView(buffer.buffer, buffer.byteOffset);
            const totalLength = view.getUint32(0, false);

            if (totalLength < 16 || buffer.length < totalLength) break;

            // Extract event
            const eventData = buffer.slice(0, totalLength);
            buffer = buffer.slice(totalLength);

            // Parse event headers and payload
            const event = parseEventFrame(eventData);
            if (!event) continue;

            const eventType = event.headers[":event-type"] || "";
            
            // Handle assistantResponseEvent
            if (eventType === "assistantResponseEvent" && event.payload?.content) {
              const chunk = {
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{
                  index: 0,
                  delta: chunkIndex === 0 
                    ? { role: "assistant", content: event.payload.content }
                    : { content: event.payload.content },
                  finish_reason: null
                }]
              };
              chunkIndex++;
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }

            // Handle codeEvent
            if (eventType === "codeEvent" && event.payload?.content) {
              const chunk = {
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{
                  index: 0,
                  delta: { content: event.payload.content },
                  finish_reason: null
                }]
              };
              chunkIndex++;
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }

            // Handle toolUseEvent
            if (eventType === "toolUseEvent" && event.payload) {
              console.log("[KIRO DEBUG] toolUseEvent payload:", JSON.stringify(event.payload, null, 2));
              
              state.hasToolCalls = true; // Track that we have tool calls
              const toolUse = event.payload;
              
              // AWS Kiro sends toolUse as object or array
              // If it's an array, process each tool separately
              const toolUses = Array.isArray(toolUse) ? toolUse : [toolUse];
              
              for (const singleToolUse of toolUses) {
                const toolCallId = singleToolUse.toolUseId || `call_${Date.now()}`;
                const toolName = singleToolUse.name || "";
                const toolInput = singleToolUse.input; // Can be undefined, string, or object

                // Get or assign tool call index
                let toolIndex;
                const isNewTool = !state.seenToolIds.has(toolCallId);
                
                if (isNewTool) {
                  // NEW TOOL: Create start chunk
                  toolIndex = state.toolCallIndex++;
                  state.seenToolIds.set(toolCallId, toolIndex);
                  
                  const startChunk = {
                    id: responseId,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [{
                      index: 0,
                      delta: {
                        ...(chunkIndex === 0 ? { role: "assistant" } : {}),
                        tool_calls: [{
                          index: toolIndex,
                          id: toolCallId,
                          type: "function",
                          function: {
                            name: toolName,
                            arguments: ""
                          }
                        }]
                      },
                      finish_reason: null
                    }]
                  };
                  chunkIndex++;
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(startChunk)}\n\n`));
                } else {
                  // EXISTING TOOL: Get its index
                  toolIndex = state.seenToolIds.get(toolCallId);
                }

                // Emit arguments chunk if input exists
                // AWS Kiro streams input as: undefined (first event) → string chunks
                if (toolInput !== undefined) {
                  let argumentsStr;
                  
                  if (typeof toolInput === 'string') {
                    // AWS Kiro sends partial JSON as STRING
                    argumentsStr = toolInput;
                  } else if (typeof toolInput === 'object') {
                    // Fallback: if it's an object, stringify it
                    argumentsStr = JSON.stringify(toolInput);
                  } else {
                    // Skip if not string or object
                    continue;
                  }
                  
                  const argsChunk = {
                    id: responseId,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [{
                      index: 0,
                      delta: {
                        tool_calls: [{
                          index: toolIndex,
                          function: {
                            arguments: argumentsStr
                          }
                        }]
                      },
                      finish_reason: null
                    }]
                  };
                  chunkIndex++;
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(argsChunk)}\n\n`));
                }
              }
            }

            // Handle messageStopEvent
            if (eventType === "messageStopEvent") {
              const chunk = {
                id: responseId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: state.hasToolCalls ? "tool_calls" : "stop"
                }]
              };
              state.finishEmitted = true;
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }

            // Detect end of stream: meteringEvent + contextUsageEvent usually come last
            // Kiro doesn't always send messageStopEvent, so we need to detect completion
            if ((eventType === "meteringEvent" || eventType === "contextUsageEvent") && !state.endDetected) {
              state.endDetected = true;
              // Schedule finish chunk emission after a short delay
              setTimeout(() => {
                if (!state.finishEmitted) {
                  state.finishEmitted = true;
                  const finishChunk = {
                    id: responseId,
                    object: "chat.completion.chunk",
                    created,
                    model,
                    choices: [{
                      index: 0,
                      delta: {},
                      finish_reason: state.hasToolCalls ? "tool_calls" : "stop"
                    }]
                  };
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
                }
              }, 100); // 100ms delay to check for more events
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        reader.cancel();
      }
    });

    // Create new response with SSE headers
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  }

  async refreshCredentials(credentials, log) {
    if (!credentials.refreshToken) return null;

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "kiro-cli/1.0.0"
        },
        body: JSON.stringify({
          refreshToken: credentials.refreshToken
        })
      });

      if (!response.ok) {
        log?.error?.("TOKEN", `Kiro refresh failed: ${response.status}`);
        return null;
      }

      const data = await response.json();

      const result = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || credentials.refreshToken,
        expiresIn: data.expiresIn || 3600
      };

      log?.info?.("TOKEN", "Kiro token refreshed");
      return result;
    } catch (error) {
      log?.error?.("TOKEN", `Kiro refresh error: ${error.message}`);
      return null;
    }
  }
}

/**
 * Parse AWS EventStream frame
 */
function parseEventFrame(data) {
  try {
    const view = new DataView(data.buffer, data.byteOffset);
    const headersLength = view.getUint32(4, false);
    
    // Parse headers
    const headers = {};
    let offset = 12; // After prelude
    const headerEnd = 12 + headersLength;

    while (offset < headerEnd && offset < data.length) {
      const nameLen = data[offset];
      offset++;
      if (offset + nameLen > data.length) break;

      const name = new TextDecoder().decode(data.slice(offset, offset + nameLen));
      offset += nameLen;

      const headerType = data[offset];
      offset++;

      if (headerType === 7) { // String type
        const valueLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        if (offset + valueLen > data.length) break;
        
        const value = new TextDecoder().decode(data.slice(offset, offset + valueLen));
        offset += valueLen;
        headers[name] = value;
      } else {
        break;
      }
    }

    // Parse payload
    const payloadStart = 12 + headersLength;
    const payloadEnd = data.length - 4; // Exclude message CRC
    
    let payload = null;
    if (payloadEnd > payloadStart) {
      const payloadStr = new TextDecoder().decode(data.slice(payloadStart, payloadEnd));
      
      // Skip empty or whitespace-only payloads
      if (!payloadStr || !payloadStr.trim()) {
        return { headers, payload: null };
      }
      
      try {
        payload = JSON.parse(payloadStr);
      } catch (parseError) {
        // Log parse error for debugging
        console.warn(`[Kiro] Failed to parse payload: ${parseError.message} | payload: ${payloadStr.substring(0, 100)}`);
        payload = { raw: payloadStr };
      }
    }

    return { headers, payload };
  } catch {
    return null;
  }
}

export default KiroExecutor;
