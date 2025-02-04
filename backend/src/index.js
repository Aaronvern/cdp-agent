const AgentCore = require('./core/agent');
const { runChatMode, runAutonomousMode } = require('./routes/agent');
require('dotenv').config();

async function main() {
  try {
    console.log("Initializing agent...");
    const { agent, config } = await AgentCore.initialize();
    
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const mode = process.argv[2]?.toLowerCase() || 'chat';

    if (mode === 'chat' || mode === '1') {
      await runChatMode(agent, config);
    } else if (mode === 'auto' || mode === '2') {
      await runAutonomousMode(agent, config);
    } else {
      console.log("Invalid mode. Defaulting to chat mode...");
      await runChatMode(agent, config);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
