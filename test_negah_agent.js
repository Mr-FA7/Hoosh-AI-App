const NegahAgent = require('./negahAgent');

async function test() {
    const negah = new NegahAgent();
    
    // Test Case 1: Initial Launch Request
    const input1 = {
        trigger: "user_request",
        human_input: "",
        last_action_status: "success",
        last_action_message: "App ready",
        current_screen_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        elapsed_time_sec: 5
    };

    console.log("--- Test Case 1: user_request ---");
    const res1 = await negah.process(input1);
    console.log(JSON.stringify(res1, null, 2));

    // Test Case 2: Timeout condition
    const input2 = {
        trigger: "loop_continue",
        last_action_status: "success",
        elapsed_time_sec: 150 // Exceeds 120s limit
    };

    console.log("\n--- Test Case 2: Timeout Abort ---");
    const res2 = await negah.process(input2);
    console.log(JSON.stringify(res2, null, 2));
}

test().catch(console.error);
