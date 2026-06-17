const AgentKernel = require('./kernel');
const ResourceManager = require('./resourceManager');
const path = require('path');
const fs = require('fs');

async function test() {
    process.env.OLLAMA_API_KEY = 'test_key_123';
    const projectRoot = '/Users/mr.fa7/Desktop/AI';
    const kernel = new AgentKernel(projectRoot, 'http://127.0.0.1:11434');
    
    // Mock critical memory pressure in ResourceManager instance used by kernel
    const originalGetStats = kernel.resManager.getHardwareStats;
    kernel.resManager.getHardwareStats = () => {
        const stats = originalGetStats.call(kernel.resManager);
        stats.system_load.ram_usage_percent = 95; // Force Critical
        return stats;
    };

    console.log("--- TEST 1: Critical Load with API Key (Ollama Cloud 120B) ---");
    // runAgentTask will call getRoutingDecision which will now see 95% RAM and the API Key
    const routing = kernel.resManager.getRoutingDecision({ type: 'reasoning', priority: 'high' });
    console.log(`Decision: ${routing.routing_decision.selected_model} via ${routing.routing_decision.execution_mode}`);
    console.log(`Reasoning: ${routing.reasoning}`);

    console.log("\n--- TEST 2: Offline Dependency Fallback ---");
    // faster-whisper is in /Users/mr.fa7/Desktop/needed/ollama-python-main (mock match)
    const hasWhisper = kernel.resManager.checkDependency('python_pip', 'ollama-python');
    console.log(`Has ollama-python (via /needed fallback): ${hasWhisper}`);
}

test();
