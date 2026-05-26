async function functionCallLoop(log, runtime, apiUrl, token, model, messages, toolDefs, depth, sendEvent) {
  if (depth > 10) {
    messages.push({ role: 'assistant', content: 'Tool call limit reached. Please refine your request.' });
    return { choices: [{ message: { role: 'assistant', content: 'Tool call limit reached. Please refine your request.' } }] };
  }

  const { callChatWithTools } = require('./aiClient');
  const { executeTool } = require('./toolDefinitions');

  const response = await callChatWithTools(log, apiUrl, token, model, messages, toolDefs);
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
    try {
      const args = JSON.parse(tc.function.arguments);
      log.info(`AI tool call: ${tc.function.name}(${JSON.stringify(args)})`);
      const result = await executeTool(runtime, tc.function.name, args);
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

  return functionCallLoop(log, runtime, apiUrl, token, model, messages, toolDefs, depth + 1, sendEvent);
}

module.exports = { functionCallLoop };
