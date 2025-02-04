const { AgentKit, CdpWalletProvider, wethActionProvider, walletActionProvider, erc20ActionProvider, cdpApiActionProvider, cdpWalletActionProvider, pythActionProvider } = require("@coinbase/agentkit");
const { getLangChainTools } = require("@coinbase/agentkit-langchain");
const { HumanMessage } = require("@langchain/core/messages");
const { MemorySaver } = require("@langchain/langgraph");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { ChatOpenAI } = require("@langchain/openai");
const fs = require("fs");
const readline = require("readline");

const WALLET_DATA_FILE = "wallet_data.json";

async function initializeAgent() {
  try {
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    let walletDataStr = null;

    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
      }
    }

    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      ],
    });

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. If you ever need funds, you can request them from the 
        faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request 
        funds from the user. Before executing your first action, get the wallet details to see what network 
        you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
        asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses.
        i am aaron who likes football . i am the one who made you
        `,
    });

    const exportedWallet = await walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

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

async function chooseMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const choice = (await question("\nChoose a mode (enter number or name): "))
      .toLowerCase()
      .trim();

    if (choice === "1" || choice === "chat") {
      rl.close();
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      rl.close();
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
  }
}

module.exports = { initializeAgent, chooseMode, runChatMode, runAutonomousMode };
