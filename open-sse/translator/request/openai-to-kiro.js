/**
 * OpenAI to Kiro Request Translator
 * Converts OpenAI Chat Completions format to Kiro/AWS CodeWhisperer format
 */
import { register } from "../index.js";
import { FORMATS } from "../formats.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Convert OpenAI messages to Kiro format
 */
function convertMessages(messages, tools, model) {
  let history = [];
  let currentMessage = null;
  let systemPrompt = "";

  // Collect tool results first (they come as separate messages with role: "tool")
  const toolResultsMap = new Map(); // Map tool_call_id -> content
  for (const msg of messages) {
    if (msg.role === "tool" && msg.tool_call_id) {
      const content = typeof msg.content === "string" ? msg.content : 
        (Array.isArray(msg.content) ? msg.content.map(c => c.text || "").join("\n") : "");
      toolResultsMap.set(msg.tool_call_id, content);
    }
  }

  for (const msg of messages) {
    const role = msg.role;
    
    // Skip tool messages - already processed above
    if (role === "tool") {
      continue;
    }
    
    const content = typeof msg.content === "string" ? msg.content : 
      (Array.isArray(msg.content) ? msg.content.map(c => c.text || "").join("\n") : "");

    if (role === "system") {
      systemPrompt += (systemPrompt ? "\n" : "") + content;
      continue;
    }

    if (role === "user") {
      const userMsg = {
        userInputMessage: {
          content: content,
          modelId: "", // Will be set later
          origin: "AI_EDITOR"
        }
      };

      // Add tools to first user message context
      if (tools && tools.length > 0 && history.length === 0) {
        userMsg.userInputMessage.userInputMessageContext = {
          tools: tools.map(t => {
            const name = t.function?.name || t.name;
            let description = t.function?.description || t.description || "";
            
            // CRITICAL: Kiro API requires non-empty description
            if (!description.trim()) {
              description = `Tool: ${name}`;
            }
            
            // Truncate long descriptions (Kiro max is ~5000 chars based on testing)
            // Keep it reasonable but allow more detail than 2000 chars
            // const maxDescLen = 5000;
            // if (description.length > maxDescLen) {
            //   // Smart truncation: keep first 80% and add marker
            //   description = description.slice(0, maxDescLen - 100) + "\n\n[Note: Full description truncated for API limits. Tool functionality remains intact.]";
            // }
            
            return {
              toolSpecification: {
                name,
                description,
                inputSchema: {
                  json: t.function?.parameters || t.parameters || {}
                }
              }
            };
          })
        };
      }

      currentMessage = userMsg;
      history.push(userMsg);
    }

    if (role === "assistant") {
      const assistantMsg = {
        assistantResponseMessage: {
          content: content
        }
      };

      // Handle tool calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        assistantMsg.assistantResponseMessage.toolUses = msg.tool_calls.map(tc => ({
          toolUseId: tc.id || uuidv4(),
          name: tc.function?.name || tc.name,
          input: typeof tc.function?.arguments === "string" 
            ? JSON.parse(tc.function.arguments) 
            : (tc.function?.arguments || tc.arguments || {})
        }));
        
        // Collect tool results for this assistant message's tool calls
        const toolResults = [];
        for (const tc of msg.tool_calls) {
          const toolResult = toolResultsMap.get(tc.id);
          if (toolResult !== undefined) {
            toolResults.push({
              content: [{ text: toolResult }],
              status: "success",
              toolUseId: tc.id
            });
          }
        }
        
        // Add tool results to the NEXT user message if they exist
        if (toolResults.length > 0) {
          // Store for next user message
          assistantMsg._pendingToolResults = toolResults;
        }
      }

      history.push(assistantMsg);
    }
  }
  
  // Apply pending tool results to user messages
  for (let i = 0; i < history.length; i++) {
    if (history[i].assistantResponseMessage?._pendingToolResults) {
      const toolResults = history[i].assistantResponseMessage._pendingToolResults;
      delete history[i].assistantResponseMessage._pendingToolResults;
      
      // Find next user message
      for (let j = i + 1; j < history.length; j++) {
        if (history[j].userInputMessage) {
          if (!history[j].userInputMessage.userInputMessageContext) {
            history[j].userInputMessage.userInputMessageContext = {};
          }
          history[j].userInputMessage.userInputMessageContext.toolResults = toolResults;
          break;
        }
      }
    }
  }
  
  // Also check currentMessage for pending tool results
  if (history.length > 0 && history[history.length - 1].assistantResponseMessage?._pendingToolResults) {
    const toolResults = history[history.length - 1].assistantResponseMessage._pendingToolResults;
    delete history[history.length - 1].assistantResponseMessage._pendingToolResults;
    
    if (currentMessage?.userInputMessage) {
      if (!currentMessage.userInputMessage.userInputMessageContext) {
        currentMessage.userInputMessage.userInputMessageContext = {};
      }
      currentMessage.userInputMessage.userInputMessageContext.toolResults = toolResults;
    }
  }

  // Pop last message as currentMessage if it's user message
  if (history.length > 0 && history[history.length - 1].userInputMessage) {
    currentMessage = history.pop();
  }

  // Move tools from history to currentMessage if needed
    const firstHistoryItem = history[0];
    if (firstHistoryItem?.userInputMessage?.userInputMessageContext?.tools && 
        !currentMessage?.userInputMessage?.userInputMessageContext?.tools) {
      // Move tools to currentMessage
      if (!currentMessage.userInputMessage.userInputMessageContext) {
        currentMessage.userInputMessage.userInputMessageContext = {};
      }
      currentMessage.userInputMessage.userInputMessageContext.tools = 
        firstHistoryItem.userInputMessage.userInputMessageContext.tools;
      console.log(`[Kiro Translator] Moved ${currentMessage.userInputMessage.userInputMessageContext.tools.length} tools to currentMessage`);
    }
    
  // CRITICAL: Clean up history for Kiro API compatibility
  // Kiro API has strict limitations on history content:
  // 1. NO toolUses in assistant messages (causes 400 Bad Request)
  // 2. NO toolResults in user messages (causes 400 Bad Request)
  // 3. NO tools definitions in history (only in currentMessage)
  // 4. NO empty userInputMessageContext objects
  // 5. modelId must NOT be empty string
  // 6. NO consecutive user messages (must alternate user/assistant)
  history.forEach(item => {
    // Remove toolUses from assistant messages (Kiro doesn't support tool history)
    if (item.assistantResponseMessage?.toolUses) {
      delete item.assistantResponseMessage.toolUses;
    }
    
    // Remove tools from user messages (only currentMessage should have tools)
    if (item.userInputMessage?.userInputMessageContext?.tools) {
      delete item.userInputMessage.userInputMessageContext.tools;
    }
    
    // Remove toolResults from user messages (Kiro doesn't support passing tool results via history)
    if (item.userInputMessage?.userInputMessageContext?.toolResults) {
      delete item.userInputMessage.userInputMessageContext.toolResults;
    }
    
    // Remove empty userInputMessageContext
    if (item.userInputMessage?.userInputMessageContext && 
        Object.keys(item.userInputMessage.userInputMessageContext).length === 0) {
      delete item.userInputMessage.userInputMessageContext;
    }
    
    // Ensure modelId is not empty (use model from params if empty)
    if (item.userInputMessage && !item.userInputMessage.modelId) {
      item.userInputMessage.modelId = model;
    }
  });
  
  // CRITICAL: Merge consecutive user messages
  // Kiro API requires alternating user/assistant pattern in history
  const mergedHistory = [];
  for (let i = 0; i < history.length; i++) {
    const current = history[i];
    
    // If current is user message and previous is also user message, merge them
    if (current.userInputMessage && 
        mergedHistory.length > 0 && 
        mergedHistory[mergedHistory.length - 1].userInputMessage) {
      // Merge content into previous user message
      const prev = mergedHistory[mergedHistory.length - 1];
      prev.userInputMessage.content += "\n\n" + current.userInputMessage.content;
      console.log(`[Kiro Translator] Merged consecutive user messages in history`);
    } else {
      // Add normally
      mergedHistory.push(current);
    }
  }
  history = mergedHistory;
  
  // Log payload size warning if system prompt is very long
  const systemPromptSize = systemPrompt.length;
  if (systemPromptSize > 10000) {
    console.warn(`[Kiro Translator] WARNING: System prompt is ${systemPromptSize} chars. Total payload may be large.`);
  }

  return { history, currentMessage, systemPrompt };
}

/**
 * Build Kiro payload from OpenAI format
 */
function buildKiroPayload(model, body, stream, credentials) {
  const messages = body.messages || [];
  const tools = body.tools || [];
  const maxTokens = body.max_tokens || 32000;
  const temperature = body.temperature;
  const topP = body.top_p;

  const { history, currentMessage, systemPrompt } = convertMessages(messages, tools, model);

  // Get profileArn from credentials
  const profileArn = credentials?.providerSpecificData?.profileArn || "";

  // Inject system prompt into current message content
  let finalContent = currentMessage?.userInputMessage?.content || "";
  if (systemPrompt) {
    // Log warning if system prompt is very long (may cause Kiro API to reject request)
    if (systemPrompt.length > 10000) {
      console.warn(`[Kiro Translator] WARNING: System prompt is very long (${systemPrompt.length} chars). Kiro API may reject requests with total content >20KB. Consider reducing system prompt length.`);
    }
    finalContent = `[System: ${systemPrompt}]\n\n${finalContent}`;
  }

  // Add timestamp context
  const timestamp = new Date().toISOString();
  finalContent = `[Context: Current time is ${timestamp}]\n\n${finalContent}`;
  
  // Log final content size for debugging
  if (finalContent.length > 20000) {
    console.warn(`[Kiro Translator] WARNING: Final content size is ${finalContent.length} chars. Kiro API typically rejects requests >20-30KB.`);
  }

  const payload = {
    conversationState: {
      chatTriggerType: "MANUAL",
      conversationId: uuidv4(),
      currentMessage: {
        userInputMessage: {
          content: finalContent,
          modelId: model,
          origin: "AI_EDITOR",
          ...(currentMessage?.userInputMessage?.userInputMessageContext && {
            userInputMessageContext: currentMessage.userInputMessage.userInputMessageContext
          })
        }
      },
      history: history
    }
  };

  // Only add profileArn if available
  if (profileArn) {
    payload.profileArn = profileArn;
  }

  // Add inference config if specified
  if (maxTokens || temperature !== undefined || topP !== undefined) {
    payload.inferenceConfig = {};
    if (maxTokens) payload.inferenceConfig.maxTokens = maxTokens;
    if (temperature !== undefined) payload.inferenceConfig.temperature = temperature;
    if (topP !== undefined) payload.inferenceConfig.topP = topP;
  }

  return payload;
}

// Register translator
register(FORMATS.OPENAI, FORMATS.KIRO, buildKiroPayload, null);

export { buildKiroPayload };
