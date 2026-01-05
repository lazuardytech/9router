import { register } from "../index.js";
import { FORMATS } from "../formats.js";
import { DEFAULT_THINKING_GEMINI_SIGNATURE } from "../../config/defaultThinkingSignature.js";
import {
  UNSUPPORTED_SCHEMA_CONSTRAINTS,
  DEFAULT_SAFETY_SETTINGS,
  convertOpenAIContentToParts,
  extractTextContent,
  tryParseJSON,
  generateRequestId,
  generateSessionId,
  generateProjectId,
  cleanJSONSchemaForAntigravity
} from "../helpers/geminiHelper.js";

// ============================================
// REQUEST TRANSLATORS: OpenAI -> Gemini/GeminiCLI/Antigravity
// ============================================

// Core: Convert OpenAI request to Gemini format (base for all variants)
function openaiToGeminiBase(model, body, stream) {
  const result = {
    model: model,
    contents: [],
    generationConfig: {},
    safetySettings: DEFAULT_SAFETY_SETTINGS
  };

  // Generation config
  if (body.temperature !== undefined) {
    result.generationConfig.temperature = body.temperature;
  }
  if (body.top_p !== undefined) {
    result.generationConfig.topP = body.top_p;
  }
  if (body.top_k !== undefined) {
    result.generationConfig.topK = body.top_k;
  }
  if (body.max_tokens !== undefined) {
    result.generationConfig.maxOutputTokens = body.max_tokens;
  }

  // Build tool_call_id -> name map
  const tcID2Name = {};
  if (body.messages && Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (msg.role === "assistant" && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.type === "function" && tc.id && tc.function?.name) {
            tcID2Name[tc.id] = tc.function.name;
          }
        }
      }
    }
  }

  // Build tool responses cache
  const toolResponses = {};
  if (body.messages && Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (msg.role === "tool" && msg.tool_call_id) {
        toolResponses[msg.tool_call_id] = msg.content;
      }
    }
  }

  // Convert messages
  if (body.messages && Array.isArray(body.messages)) {
    for (let i = 0; i < body.messages.length; i++) {
      const msg = body.messages[i];
      const role = msg.role;
      const content = msg.content;

      if (role === "system" && body.messages.length > 1) {
        result.systemInstruction = {
          role: "user",
          parts: [{ text: typeof content === "string" ? content : extractTextContent(content) }]
        };
      } else if (role === "user" || (role === "system" && body.messages.length === 1)) {
        const parts = convertOpenAIContentToParts(content);
        if (parts.length > 0) {
          result.contents.push({ role: "user", parts });
        }
      } else if (role === "assistant") {
        const parts = [];
        
        if (content) {
          const text = typeof content === "string" ? content : extractTextContent(content);
          if (text) {
            parts.push({ text });
          }
        }

        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          const toolCallIds = [];
          for (const tc of msg.tool_calls) {
            if (tc.type !== "function") continue;
            
            const args = tryParseJSON(tc.function?.arguments || "{}");
            parts.push({
              thoughtSignature: DEFAULT_THINKING_GEMINI_SIGNATURE,
              functionCall: {
                id: tc.id,
                name: tc.function.name,
                args: args
              }
            });
            toolCallIds.push(tc.id);
          }

          if (parts.length > 0) {
            result.contents.push({ role: "model", parts });
          }

          // Append function responses - extract name from tool_call_id format "ToolName-timestamp-index"
          const toolParts = [];
          for (const fid of toolCallIds) {
            // Try to get name from tcID2Name map first, then extract from id format
            let name = tcID2Name[fid];
            if (!name) {
              // Extract name from id format: "ToolName-timestamp-index"
              const idParts = fid.split("-");
              if (idParts.length > 2) {
                name = idParts.slice(0, -2).join("-");
              } else {
                name = fid;
              }
            }
            
              let resp = toolResponses[fid] || "{}";
              let parsedResp = tryParseJSON(resp);
              if (parsedResp === null) {
                parsedResp = { result: resp };
              } else if (typeof parsedResp !== "object") {
                parsedResp = { result: parsedResp };
              }
              
              toolParts.push({
                functionResponse: {
                  id: fid,
                  name: name,
                  response: { result: parsedResp }
                }
              });
          }
          if (toolParts.length > 0) {
            result.contents.push({ role: "user", parts: toolParts });
          }
        } else if (parts.length > 0) {
          result.contents.push({ role: "model", parts });
        }
      }
    }
  }

  // Convert tools
  if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
    const functionDeclarations = [];
    for (const t of body.tools) {
      if (t.type === "function" && t.function) {
        const fn = t.function;
        functionDeclarations.push({
          name: fn.name,
          description: fn.description || "",
          parameters: fn.parameters || { type: "object", properties: {} }
        });
      }
    }
    
    if (functionDeclarations.length > 0) {
      result.tools = [{ functionDeclarations }];
    }
  }

  return result;
}

// OpenAI -> Gemini (standard API)
function openaiToGemini(model, body, stream) {
  return openaiToGeminiBase(model, body, stream);
}

// OpenAI -> Gemini CLI (Cloud Code Assist)
function openaiToGeminiCLI(model, body, stream) {
  const gemini = openaiToGeminiBase(model, body, stream);
  const isClaude = model.toLowerCase().includes("claude");
  
  // Add thinking config for CLI
  if (body.reasoning_effort) {
    const budgetMap = { low: 1024, medium: 8192, high: 32768 };
    const budget = budgetMap[body.reasoning_effort] || 8192;
    gemini.generationConfig.thinkingConfig = {
      thinkingBudget: budget,
      include_thoughts: true
    };
  }

  // Thinking config from Claude format
  if (body.thinking?.type === "enabled" && body.thinking.budget_tokens) {
    gemini.generationConfig.thinkingConfig = {
      thinkingBudget: body.thinking.budget_tokens,
      include_thoughts: true
    };
  }

  // Clean schema for tools
  // Claude models: use "parameters" (backend converts parametersJsonSchema -> parameters)
  // Gemini native: use "parametersJsonSchema" (backend expects this field)
  if (gemini.tools?.[0]?.functionDeclarations) {
    for (const fn of gemini.tools[0].functionDeclarations) {
      if (fn.parameters) {
        const cleanedSchema = cleanJSONSchemaForAntigravity(fn.parameters);
        if (isClaude) {
          fn.parameters = cleanedSchema;
        } else {
          fn.parametersJsonSchema = cleanedSchema;
          delete fn.parameters;
        }
      }
    }
  }

  return gemini;
}

// Wrap Gemini CLI format in Cloud Code wrapper
function wrapInCloudCodeEnvelope(model, geminiCLI, credentials = null) {
  // Use real project ID if available, otherwise generate random
  const projectId = credentials?.projectId || generateProjectId();
  
  return {
    project: projectId,
    model: model,
    userAgent: "gemini-cli",
    requestId: generateRequestId(),
    request: {
      sessionId: generateSessionId(),
      contents: geminiCLI.contents,
      systemInstruction: geminiCLI.systemInstruction,
      generationConfig: geminiCLI.generationConfig,
      safetySettings: geminiCLI.safetySettings,
      tools: geminiCLI.tools,
    }
  };
}

// OpenAI -> Antigravity (Sandbox Cloud Code with wrapper)
function openaiToAntigravity(model, body, stream, credentials = null) {
  const geminiCLI = openaiToGeminiCLI(model, body, stream);
  return wrapInCloudCodeEnvelope(model, geminiCLI, credentials);
}

// ============================================
// RESPONSE TRANSLATORS: Gemini/GeminiCLI/Antigravity -> OpenAI
// ============================================

// Core: Convert Gemini response chunk to OpenAI format
function geminiToOpenAIResponse(chunk, state) {
  if (!chunk) return null;
  
  // Handle Antigravity wrapper
  const response = chunk.response || chunk;
  if (!response || !response.candidates?.[0]) return null;

  const results = [];
  const candidate = response.candidates[0];
  const content = candidate.content;

  // Initialize state
  if (!state.messageId) {
    state.messageId = response.responseId || `msg_${Date.now()}`;
    state.model = response.modelVersion || "gemini";
    state.functionIndex = 0;
    results.push({
      id: `chatcmpl-${state.messageId}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: state.model,
      choices: [{
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null
      }]
    });
  }

  // Process parts
  if (content?.parts) {
    for (const part of content.parts) {
      const hasThoughtSig = part.thoughtSignature || part.thought_signature;
      const isThought = part.thought === true;
      
      // Handle thought signature (thinking mode)
      if (hasThoughtSig) {
        const hasTextContent = part.text !== undefined && part.text !== "";
        const hasFunctionCall = !!part.functionCall;
        // If there's text with thoughtSignature
        if (hasTextContent) {
        results.push({
          id: `chatcmpl-${state.messageId}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: state.model,
          choices: [{
            index: 0,
            delta: isThought 
              ? { reasoning_content: part.text }
              : { content: part.text },
              finish_reason: null
            }]
          });
        }
        
        // Process functionCall if exists, then skip to next part
        if (hasFunctionCall) {
          const fcName = part.functionCall.name;
          const fcArgs = part.functionCall.args || {};
          const toolCallIndex = state.functionIndex++;
          
          const toolCall = {
            id: `${fcName}-${Date.now()}-${toolCallIndex}`,
            index: toolCallIndex,
            type: "function",
            function: {
              name: fcName,
              arguments: JSON.stringify(fcArgs)
            }
          };
          
          state.toolCalls.set(toolCallIndex, toolCall);
          
          results.push({
            id: `chatcmpl-${state.messageId}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: state.model,
            choices: [{
              index: 0,
              delta: { tool_calls: [toolCall] },
              finish_reason: null
            }]
          });
        }
        continue;
      }

      // Text content (non-thinking) - skip empty text
      if (part.text !== undefined && part.text !== "") {
        results.push({
          id: `chatcmpl-${state.messageId}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: state.model,
          choices: [{
            index: 0,
            delta: { content: part.text },
            finish_reason: null
          }]
        });
      }

      // Function call
      if (part.functionCall) {
        const fcName = part.functionCall.name;
        const fcArgs = part.functionCall.args || {};
        const toolCallIndex = state.functionIndex++;
        
        const toolCall = {
          id: `${fcName}-${Date.now()}-${toolCallIndex}`,
          index: toolCallIndex,
          type: "function",
          function: {
            name: fcName,
            arguments: JSON.stringify(fcArgs)
          }
        };
        
        state.toolCalls.set(toolCallIndex, toolCall);
        
        results.push({
          id: `chatcmpl-${state.messageId}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: state.model,
          choices: [{
            index: 0,
            delta: { tool_calls: [toolCall] },
            finish_reason: null
          }]
        });
      }

      // Inline data (images)
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData?.data) {
        const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
        results.push({
          id: `chatcmpl-${state.messageId}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: state.model,
          choices: [{
            index: 0,
            delta: {
              images: [{
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${inlineData.data}` }
              }]
            },
            finish_reason: null
          }]
        });
      }
    }
  }

  // Finish reason
  if (candidate.finishReason) {
    let finishReason = candidate.finishReason.toLowerCase();
    if (finishReason === "stop" && state.toolCalls.size > 0) {
      finishReason = "tool_calls";
    }
    
    results.push({
      id: `chatcmpl-${state.messageId}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: state.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: finishReason
      }]
    });
    state.finishReason = finishReason;
  }

  // Usage metadata
  const usage = response.usageMetadata || chunk.usageMetadata;
  if (usage) {
    const promptTokens = (usage.promptTokenCount || 0) + (usage.thoughtsTokenCount || 0);
    state.usage = {
      prompt_tokens: promptTokens,
      completion_tokens: usage.candidatesTokenCount || 0,
      total_tokens: usage.totalTokenCount || 0
    };
    if (usage.thoughtsTokenCount > 0) {
      state.usage.completion_tokens_details = {
        reasoning_tokens: usage.thoughtsTokenCount
      };
    }
  }

  return results.length > 0 ? results : null;
}

// ============================================
// REGISTER ALL TRANSLATORS
// ============================================

// Request: OpenAI -> Gemini variants
register(FORMATS.OPENAI, FORMATS.GEMINI, openaiToGemini, null);
register(FORMATS.OPENAI, FORMATS.GEMINI_CLI, (model, body, stream, credentials) => wrapInCloudCodeEnvelope(model, openaiToGeminiCLI(model, body, stream), credentials), null);
register(FORMATS.OPENAI, FORMATS.ANTIGRAVITY, openaiToAntigravity, null);

// Response: Gemini variants -> OpenAI (all use same handler)
register(FORMATS.GEMINI, FORMATS.OPENAI, null, geminiToOpenAIResponse);
register(FORMATS.GEMINI_CLI, FORMATS.OPENAI, null, geminiToOpenAIResponse);
register(FORMATS.ANTIGRAVITY, FORMATS.OPENAI, null, geminiToOpenAIResponse);
