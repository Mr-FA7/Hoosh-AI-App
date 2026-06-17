const NegahAgent = require('./negahAgent');

async function test() {
    const n = new NegahAgent();
    
    console.log("--- TEST 1: Initial Trigger ---");
    const res1 = await n.process({
        trigger: 'user_request',
        last_action_status: 'success',
        last_action_message: 'Start QA on http://localhost:5173',
        elapsed_time_sec: 0
    });
    console.log(JSON.stringify(res1, null, 2));

    console.log("\n--- TEST 2: Timeout Check ---");
    const res2 = await n.process({
        trigger: 'loop_continue',
        elapsed_time_sec: 125
    });
    console.log(JSON.stringify(res2, null, 2));
}

test();
