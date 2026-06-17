const AgentKernel = require('./kernel');
const path = require('path');

async function main() {
    const projectRoot = path.join(__dirname, 'test-prj');
    const ollamaUrl = 'http://127.0.0.1:11434';
    const kernel = new AgentKernel(projectRoot, ollamaUrl);

    await kernel.init();

    const onEvent = (event) => {
        console.log(`[EVENT] ${event.type}: ${event.message || event.name || ''}`);
    };

    // Step 1: Create Python app
    console.log("--- STEP 1: Creating Python App ---");
    await kernel.executeAutonomousLoop("Create a simple Python Tkinter GUI application. It should have a blue background and a label 'Hello Nava AI'. Create it as 'main.py'.", { onEvent });

    // Step 2: Build installer
    console.log("\n--- STEP 2: Creating .app and Installer ---");
    await kernel.executeAutonomousLoop("Create a macOS .app bundle and a DMG installer for this Python application. You can use py2app or similar tools if necessary, or just script the creation of folder structure for a mockup if tools are missing.", { onEvent });

    // Step 3: Change theme
    console.log("\n--- STEP 3: Updating Theme Color ---");
    await kernel.executeAutonomousLoop("Change the background color of the main window to dark grey. Update the .app and installer to reflect this change. Ensure you only patch the color value, don't rewrite everything.", { onEvent });

    console.log("\n--- DONE ---");
}

main().catch(console.error);
