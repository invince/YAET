async function functionCallLoop(log, runtime, apiUrl, token, model, messages, toolDefs, depth, sendEvent, sessionContext = {}, opts = {}) {
  const signal = opts.signal;
  const timeoutMs = opts.timeoutMs;
  // P1-1: never mutate the caller's payload — retries would resend tool results.
  messages = messages.slice();
  if (signal?.aborted) throw new Error('Cancelled by user');
  // P1-1C: context-budget guard (same len/4 convention as aiChat.js).
  // Depth cap stops long runs; this stops FAT runs (huge tool outputs).
  if (opts.maxLoopTokens && estimateTokens(messages) > opts.maxLoopTokens) {
    const note = 'Context budget exceeded. Please start a new chat or narrow the request.';
    return { choices: [{ message: { role: 'assistant', content: note } }] };
  }
  if (depth > 10) {
    messages.push({ role: 'assistant', content: 'Tool call limit reached. Please refine your request.' });
    return { choices: [{ message: { role: 'assistant', content: 'Tool call limit reached. Please refine your request.' } }] };
  }

  const { callChatWithTools } = require('./aiClient');
  const { executeTool } = require('./toolDefinitions');

  const response = await callChatWithTools(log, apiUrl, token, model, messages, toolDefs, { signal, timeoutMs });
  const choice = response.choices?.[0];
  if (!choice) throw new Error('No response from AI');

  const message = choice.message;
  if (!message.tool_calls || message.tool_calls.length === 0) {
    return response;
  }

  messages.push({
    ...message,
    content: message.content || null,
  });

  for (const tc of message.tool_calls) {
    // P1-1: on abort, skip remaining tools (executed ones are discarded with
    // the whole run) instead of burning more money/time.
    if (signal?.aborted) break;
    try {
      const args = JSON.parse(tc.function.arguments);
      log.info(`AI tool call: ${tc.function.name}(${JSON.stringify(args)})`);
      const result = await executeTool(runtime, tc.function.name, args, sessionContext);
      if (sendEvent) {
        try { sendEvent({ toolName: tc.function.name, args, result, error: null, ts: Date.now() }); } catch (_) {}
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    } catch (err) {
      log.error(`AI tool error ${tc.function.name}: ${err.message}`);
      if (sendEvent) {
        try { sendEvent({ toolName: tc.function.name, args, result: null, error: err.message, ts: Date.now() }); } catch (_) {}
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({ error: err.message }),
      });
    }
  }

  if (signal?.aborted) throw new Error('Cancelled by user');
  return functionCallLoop(log, runtime, apiUrl, token, model, messages, toolDefs, depth + 1, sendEvent, sessionContext, opts);
}

function estimateTokens(messages) {
  let len = 0;
  for (const m of (messages || [])) {
    if (typeof m.content === 'string') len += m.content.length;
    else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p && typeof p.text === 'string') len += p.text.length;
      }
    }
    for (const tc of (m.tool_calls || [])) {
      try { len += (tc.function?.arguments || '').length; } catch (_) {}
    }
  }
  return Math.ceil(len / 4);
}

module.exports = { functionCallLoop };
