const ResourceManager = require('./resourceManager');

async function test() {
    const resManager = new ResourceManager();
    
    console.log("--- Current Hardware Stats ---");
    console.log(JSON.stringify(resManager.getHardwareStats(), null, 2));

    const tasks = [
        { type: 'chat', priority: 'medium', latency_sensitive: true },
        { type: 'coding', priority: 'high', latency_sensitive: false },
        { type: 'summarization', priority: 'low', latency_sensitive: false }
    ];

    console.log("\n--- Routing Decisions ---");
    for (const task of tasks) {
        console.log(`\nTask: ${task.type} (Latency: ${task.latency_sensitive})`);
        const decision = resManager.getRoutingDecision(task);
        console.log(JSON.stringify(decision, null, 2));
    }
}

test().catch(console.error);
