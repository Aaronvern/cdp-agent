const { AgentKit, CdpWalletProvider, wethActionProvider, walletActionProvider, erc20ActionProvider, cdpApiActionProvider, cdpWalletActionProvider, pythActionProvider } = require("@coinbase/agentkit");
const { getLangChainTools } = require("@coinbase/agentkit-langchain");
const { MemorySaver } = require("@langchain/langgraph");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { ChatOpenAI } = require("@langchain/openai");
const fs = require("fs");
const config = require('../config/config');

const WALLET_DATA_FILE = "wallet_data.json";

class AgentCore {
  static async initialize() {
    try {
      const llm = new ChatOpenAI({
        model: config.openai.model,
      });

      let walletDataStr = null;
      if (fs.existsSync(WALLET_DATA_FILE)) {
        try {
          walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
        } catch (error) {
          console.error("Error reading wallet data:", error);
        }
      }

      const walletProvider = await CdpWalletProvider.configureWithWallet({
        apiKeyName: config.cdp.apiKeyName,
        apiKeyPrivateKey: config.cdp.apiKeyPrivateKey,
        cdpWalletData: walletDataStr || undefined,
        networkId: config.cdp.networkId,
      });

      const agentkit = await AgentKit.from({
        walletProvider,
        actionProviders: [
          wethActionProvider(),
          pythActionProvider(),
          walletActionProvider(),
          erc20ActionProvider(),
          cdpApiActionProvider({
            apiKeyName: config.cdp.apiKeyName,
            apiKeyPrivateKey: config.cdp.apiKeyPrivateKey,
          }),
          cdpWalletActionProvider({
            apiKeyName: config.cdp.apiKeyName,
            apiKeyPrivateKey: config.cdp.apiKeyPrivateKey,
          }),
        ],
      });

      const tools = await getLangChainTools(agentkit);
      const memory = new MemorySaver();

      const agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: memory,
        messageModifier: this.getMessageModifier(),
      });

      const exportedWallet = await walletProvider.exportWallet();
      fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

      return {
        agent,
        config: {
          configurable: { thread_id: "CDP AgentKit Chatbot" },
          walletAddress: walletProvider.address
        }
      };
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      throw error;
    }
  }

  static getMessageModifier() {
    return `
      You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit.
      You can analyze Twitter data and create meme coins based on trending topics.
      If you need funds, request them from the faucet if on network ID 'base-sepolia'.
      Be concise and helpful with your responses.
    `;
  }
}

module.exports = AgentCore; 