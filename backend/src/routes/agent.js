const { HumanMessage } = require("@langchain/core/messages");

async function runAutonomousMode(agent, config, interval = 10) {
  console.log("Starting autonomous mode...");
  while (true) {
    try {
      const thought = "Be creative and do something interesting on the blockchain.";

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  }
}

async function runChatMode(agent, config) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  try {
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

module.exports = { runChatMode, runAutonomousMode };
