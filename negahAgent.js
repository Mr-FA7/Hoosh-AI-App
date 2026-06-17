const axios = require('axios');

class NegahAgent {
    constructor(ollamaUrl = 'http://127.0.0.1:11434') {
        this.ollamaUrl = ollamaUrl;
        this.model = 'mistral'; // Optimized for 8GB RAM logic
        this.globalTimeout = 120;
        this.maxActions = 50;
        this.retryLimit = 3;
    }

    async process(input) {
        // 1. INPUT CONTRACT VALIDATION
        if (!input || !input.trigger) {
            return {
                error: { code: "INVALID_INPUT", message: "Missing or malformed input data." }
            };
        }

        // 2. FAIL-SAFE: GLOBAL TIMEOUT
        if (input.elapsed_time_sec > this.globalTimeout) {
            return {
                agent_resolution: {
                    status: "aborted",
                    reason: `Task exceeded ${this.globalTimeout} seconds global timeout.`
                }
            };
        }

        // 3. SYSTEM PROMPT (STRICT SPEC)
        const systemPrompt = `You are Negah, the Autonomous Visual QA & UI Interaction Agent.
Acts as the Eyes and Hands of the development team.

CAPABILITIES:
- launch_web, launch_desktop, capture_screen, find_element, mouse_click, keyboard_type, wait, ask_human, abort_task.

VISUAL INSPECTION RULES:
- Detect bugs: overlap, broken_CSS, missing_button, blank_screen, toast_error.
- Classify Severity: High (Blocker), Medium (Functional/Visual Bug), Low (Cosmetic).
- Rule: NEVER guess X/Y coordinates. Use find_element first.
- Rule: Max 3 retries for find_element. If failed, use ask_human.

OUTPUT FORMAT (STRICT JSON ONLY):
ACTION PHASE (To take next step):
{
  "agent_action": {
    "step": "string",
    "commands": [ { "action": "string", "params": {} } ],
    "reasoning": "string"
  }
}

RESOLUTION PHASE (If finished or bug found):
{
  "agent_resolution": {
    "status": "bug_found | fixed | aborted",
    "severity": "High | Medium | Low",
    "visual_analysis": "string",
    "suggested_code_fix": { "file": "string", "patch": "string" },
    "summary": { "actions_taken": number, "elapsed_time_sec": number, "bugs_detected": number }
  }
}

Wait for input JSON. Output JSON only.`;

        // 4. LLM EXECUTION
        try {
            const prompt = JSON.stringify({
                trigger: input.trigger,
                human_input: input.human_input || "",
                last_action_status: input.last_action_status || "none",
                last_action_message: input.last_action_message || "none",
                elapsed_time_sec: input.elapsed_time_sec || 0,
                screen_state: input.current_screen_base64 ? "CAPTURED" : "PENDING"
            });

            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.model,
                system: systemPrompt,
                prompt: prompt,
                stream: false,
                format: 'json',
                images: input.current_screen_base64 ? [input.current_screen_base64.replace(/^data:image\/png;base64,/, '')] : []
            });

            // 5. OUTPUT VALIDATION
            try {
                const result = JSON.parse(response.data.response);
                
                // Final safeguard for context adherence
                if (result.agent_action || result.agent_resolution) {
                    return result;
                }
                throw new Error("Invalid output keys");
            } catch (e) {
                return {
                    agent_action: {
                        step: "retry_observation",
                        commands: [{ action: "capture_screen", params: {} }],
                        reasoning: "LLM output formatting error. Retrying with fresh observation."
                    }
                };
            }
        } catch (err) {
            console.error(`[Negah] Bridge Error:`, err.message);
            return {
                agent_resolution: {
                    status: "aborted",
                    reason: `Internal execution error: ${err.message}`
                }
            };
        }
    }
}

module.exports = NegahAgent;
