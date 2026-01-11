import { register } from "../index.js";
import { FORMATS } from "../formats.js";
import { DEFAULT_THINKING_GEMINI_SIGNATURE } from "../../config/defaultThinkingSignature.js";

function generateUUID() {
  return crypto.randomUUID();
}
import {
  DEFAULT_SAFETY_SETTINGS,
  convertOpenAIContentToParts,
  extractTextContent,
  tryParseJSON,
  generateRequestId,
  generateSessionId,
  generateProjectId,
  cleanJSONSchemaForAntigravity
} from "../helpers/geminiHelper.js";

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

          // Append function responses
          const toolParts = [];
          for (const fid of toolCallIds) {
            let name = tcID2Name[fid];
            if (!name) {
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
function openaiToGeminiRequest(model, body, stream) {
  return openaiToGeminiBase(model, body, stream);
}

// OpenAI -> Gemini CLI (Cloud Code Assist)
function openaiToGeminiCLIRequest(model, body, stream) {
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
function wrapInCloudCodeEnvelope(model, geminiCLI, credentials = null, isAntigravity = false) {
  const projectId = credentials?.projectId || generateProjectId();
  
  const envelope = {
    project: projectId,
    model: model,
    userAgent: isAntigravity ? "antigravity" : "gemini-cli",
    requestId: isAntigravity ? `agent-${generateUUID()}` : generateRequestId(),
    request: {
      sessionId: generateSessionId(),
      contents: geminiCLI.contents,
      systemInstruction: geminiCLI.systemInstruction,
      generationConfig: geminiCLI.generationConfig,
      tools: geminiCLI.tools,
    }
  };

  // Antigravity specific fields
  if (isAntigravity) {
    envelope.requestType = "agent";
    // Remove safetySettings for Antigravity
    // Add toolConfig for Antigravity
    if (geminiCLI.tools?.length > 0) {
      envelope.request.toolConfig = {
        functionCallingConfig: { mode: "VALIDATED" }
      };
    }
  } else {
    // Keep safetySettings for Gemini CLI
    envelope.request.safetySettings = geminiCLI.safetySettings;
  }

  return envelope;
}

// OpenAI -> Antigravity (Sandbox Cloud Code with wrapper)
function openaiToAntigravityRequest(model, body, stream, credentials = null) {
  const geminiCLI = openaiToGeminiCLIRequest(model, body, stream);
  return wrapInCloudCodeEnvelope(model, geminiCLI, credentials, true);
}

// Register
register(FORMATS.OPENAI, FORMATS.GEMINI, openaiToGeminiRequest, null);
register(FORMATS.OPENAI, FORMATS.GEMINI_CLI, (model, body, stream, credentials) => wrapInCloudCodeEnvelope(model, openaiToGeminiCLIRequest(model, body, stream), credentials), null);
register(FORMATS.OPENAI, FORMATS.ANTIGRAVITY, openaiToAntigravityRequest, null);

