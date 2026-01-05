import { register } from "../index.js";
import { FORMATS } from "../formats.js";
import { CLAUDE_SYSTEM_PROMPT } from "../../config/constants.js";
import { adjustMaxTokens } from "../helpers/maxTokensHelper.js";

// Convert OpenAI request to Claude format
function openaiToClaude(model, body, stream) {
  const result = {
    model: model,
    max_tokens: adjustMaxTokens(body),
    stream: stream
  };

  // Temperature
  if (body.temperature !== undefined) {
    result.temperature = body.temperature;
  }

  // Messages
  result.messages = [];
  const systemParts = [];

  if (body.messages && Array.isArray(body.messages)) {
    // Extract system messages
    for (const msg of body.messages) {
      if (msg.role === "system") {
        systemParts.push(typeof msg.content === "string" ? msg.content : extractTextContent(msg.content));
      }
    }
    
    // Filter out system messages for separate processing
    const nonSystemMessages = body.messages.filter(m => m.role !== "system");
    
    // Process messages with merging logic
    // CRITICAL: tool_result must be in separate message immediately after tool_use
    let currentRole = undefined;
    let currentParts = [];

    const flushCurrentMessage = () => {
      if (currentRole && currentParts.length > 0) {
        result.messages.push({ role: currentRole, content: currentParts });
        currentParts = [];
      }
    };

    for (const msg of nonSystemMessages) {
      const newRole = (msg.role === "user" || msg.role === "tool") ? "user" : "assistant";
      const blocks = getContentBlocksFromMessage(msg);
      const hasToolUse = blocks.some(b => b.type === "tool_use");
      const hasToolResult = blocks.some(b => b.type === "tool_result");

      // Separate tool_result from other content
      if (hasToolResult) {
        const toolResultBlocks = blocks.filter(b => b.type === "tool_result");
        const otherBlocks = blocks.filter(b => b.type !== "tool_result");

        // Flush current message first
        flushCurrentMessage();

        // Add tool_result as separate user message
        if (toolResultBlocks.length > 0) {
          result.messages.push({ role: "user", content: toolResultBlocks });
        }

        // Add other blocks to current parts for next message
        if (otherBlocks.length > 0) {
          currentRole = newRole;
          currentParts.push(...otherBlocks);
        }
        continue;
      }

      if (currentRole !== newRole) {
        flushCurrentMessage();
        currentRole = newRole;
      }

      currentParts.push(...blocks);

      if (hasToolUse) {
        flushCurrentMessage();
      }
    }

    flushCurrentMessage();
    
    // Add cache_control to last assistant message (like worker.old)
    for (let i = result.messages.length - 1; i >= 0; i--) {
      const message = result.messages[i];
      if (message.role === "assistant" && Array.isArray(message.content) && message.content.length > 0) {
        const lastBlock = message.content[message.content.length - 1];
        if (lastBlock) {
          lastBlock.cache_control = { type: "ephemeral" };
          break;
        }
      }
    }
  }

  // System with Claude Code prompt and cache_control
  const claudeCodePrompt = { type: "text", text: CLAUDE_SYSTEM_PROMPT };
  
  if (systemParts.length > 0) {
    const systemText = systemParts.join("\n");
    result.system = [
      claudeCodePrompt,
      { type: "text", text: systemText, cache_control: { type: "ephemeral", ttl: "1h" } }
    ];
  } else {
    result.system = [claudeCodePrompt];
  }

  // Tools - convert from OpenAI format to Claude format
  if (body.tools && Array.isArray(body.tools)) {
    result.tools = body.tools.map(tool => {
      // Handle both OpenAI format {type: "function", function: {...}} and direct format
      const toolData = tool.type === "function" && tool.function ? tool.function : tool;
      return {
        name: toolData.name,
        description: toolData.description || "",
        input_schema: toolData.parameters || toolData.input_schema || { type: "object", properties: {}, required: [] }
      };
    });
    
    // Add cache control to last tool (like worker.old)
    if (result.tools.length > 0) {
      result.tools[result.tools.length - 1].cache_control = { type: "ephemeral", ttl: "1h" };
    }
    
    // console.log("[CLAUDE TOOLS DEBUG] Converted tools:", result.tools.map(t => t.name));
  }

  // Tool choice
  if (body.tool_choice) {
    result.tool_choice = convertOpenAIToolChoice(body.tool_choice);
  }

  return result;
}

// Convert OpenAI request to Gemini format
function openaiToGemini(model, body, stream) {
  const result = {
    contents: [],
    generationConfig: {}
  };

  // Generation config
  if (body.max_tokens) {
    result.generationConfig.maxOutputTokens = body.max_tokens;
  }
  if (body.temperature !== undefined) {
    result.generationConfig.temperature = body.temperature;
  }
  if (body.top_p !== undefined) {
    result.generationConfig.topP = body.top_p;
  }

  // Messages
  if (body.messages && Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (msg.role === "system") {
        result.systemInstruction = {
          parts: [{ text: typeof msg.content === "string" ? msg.content : extractTextContent(msg.content) }]
        };
      } else if (msg.role === "tool") {
        result.contents.push({
          role: "function",
          parts: [{
            functionResponse: {
              name: msg.tool_call_id,
              response: tryParseJSON(msg.content)
            }
          }]
        });
      } else {
        const converted = convertOpenAIToGeminiContent(msg);
        if (converted) {
          result.contents.push(converted);
        }
      }
    }
  }

  // Tools
  if (body.tools && Array.isArray(body.tools)) {
    const validTools = body.tools.filter(tool => tool && tool.function && tool.function.name);
    if (validTools.length > 0) {
      result.tools = [{
        functionDeclarations: validTools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description || "",
          parameters: tool.function.parameters || { type: "object", properties: {} }
        }))
      }];
    }
  }

  return result;
}

// Get content blocks from single message (like src.cc getContentBlocksFromMessage)
function getContentBlocksFromMessage(msg) {
  const blocks = [];

  if (msg.role === "tool") {
    blocks.push({
      type: "tool_result",
      tool_use_id: msg.tool_call_id,
      content: msg.content
    });
  } else if (msg.role === "user") {
    if (typeof msg.content === "string") {
      if (msg.content) {
        blocks.push({ type: "text", text: msg.content });
      }
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          blocks.push({ type: "text", text: part.text });
        } else if (part.type === "tool_result") {
          blocks.push({
            type: "tool_result",
            tool_use_id: part.tool_use_id,
            content: part.content,
            ...(part.is_error && { is_error: part.is_error })
          });
        } else if (part.type === "image_url") {
          const url = part.image_url.url;
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            blocks.push({
              type: "image",
              source: { type: "base64", media_type: match[1], data: match[2] }
            });
          }
        } else if (part.type === "image" && part.source) {
          blocks.push({ type: "image", source: part.source });
        }
      }
    }
  } else if (msg.role === "assistant") {
    // Handle Anthropic format: content is array with tool_use blocks
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          blocks.push({ type: "text", text: part.text });
        } else if (part.type === "tool_use") {
          blocks.push({ type: "tool_use", id: part.id, name: part.name, input: part.input });
        }
      }
    } else if (msg.content) {
      const text = typeof msg.content === "string" ? msg.content : extractTextContent(msg.content);
      if (text) {
        blocks.push({ type: "text", text });
      }
    }

    // Handle OpenAI format: tool_calls array
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.type === "function") {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: tryParseJSON(tc.function.arguments)
          });
        }
      }
    }
  }

  return blocks;
}

// Convert single OpenAI message to Claude format (for backward compatibility)
function convertOpenAIMessage(msg) {
  const role = msg.role === "assistant" ? "assistant" : "user";
  const content = convertOpenAIMessageContent(msg);
  
  if (content.length === 0) return null;

  return { role, content };
}

// Convert OpenAI message to Gemini content
function convertOpenAIToGeminiContent(msg) {
  const role = msg.role === "assistant" ? "model" : "user";
  const parts = [];

  // Text content
  if (typeof msg.content === "string") {
    if (msg.content) {
      parts.push({ text: msg.content });
    }
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === "text") {
        parts.push({ text: part.text });
      } else if (part.type === "image_url") {
        const url = part.image_url.url;
        if (url.startsWith("data:")) {
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        }
      }
    }
  }

  // Tool calls
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      parts.push({
        functionCall: {
          name: tc.function.name,
          args: tryParseJSON(tc.function.arguments)
        }
      });
    }
  }

  if (parts.length === 0) return null;

  return { role, parts };
}

// Convert tool choice
function convertOpenAIToolChoice(choice) {
  if (!choice) return { type: "auto" };
  // Passthrough if already Claude format
  if (typeof choice === "object" && choice.type) return choice;
  if (choice === "auto" || choice === "none") return { type: "auto" };
  if (choice === "required") return { type: "any" };
  if (typeof choice === "object" && choice.function) {
    return { type: "tool", name: choice.function.name };
  }
  return { type: "auto" };
}

// Extract text from content
function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter(c => c.type === "text").map(c => c.text).join("\n");
  }
  return "";
}

// Try parse JSON
function tryParseJSON(str) {
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// Register
register(FORMATS.OPENAI, FORMATS.CLAUDE, openaiToClaude, null);
register(FORMATS.OPENAI, FORMATS.GEMINI, openaiToGemini, null);
register(FORMATS.OPENAI, FORMATS.GEMINI_CLI, openaiToGemini, null);


