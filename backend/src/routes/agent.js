const { HumanMessage } = require("@langchain/core/messages");
const TwitterService = require("../services/twitterService");
const ipfsService = require("../services/ipfsService");
const readline = require("readline");

async function processProductAnalysis(twitterService, { twitterHandle, productInfo, walletAddress }) {
  try {
    // 1. Extract keywords from product info
    const keywords = await twitterService.extractKeywords(productInfo);
    console.log("Extracted keywords:", keywords.join(", "));

    // 2. Scrape Twitter data
    const tweets = await twitterService.scrapeTwitterData(twitterHandle, keywords);
    console.log(`Found ${tweets.length} relevant tweets`);

    // 3. Generate template using agent
    const template = await twitterService.generateTemplate(tweets, productInfo, walletAddress);

    // 4. Store on IPFS
    const ipfsResult = await ipfsService.uploadToIPFS({
      ...template,
      metadata: {
        keywords,
        tweet_count: tweets.length,
        timestamp: new Date().toISOString()
      }
    });

    return {
      template,
      ipfs: ipfsResult
    };
  } catch (error) {
    console.error("Error in product analysis:", error);
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

async function displayAnalysisResults(result) {
  console.log("\n=== Analysis Summary ===");
  console.log(`Total Mentions: ${result.summary.totalMentions}`);
  console.log(`High Engagement Tweets: ${result.summary.highEngagementCount}`);
  console.log(`Verified Mentions: ${result.summary.verifiedMentions}`);
  
  console.log("\n=== Sentiment Breakdown ===");
  console.log(result.summary.sentiment);
  
  console.log("\n=== Product Summary ===");
  console.log(result.analysis.summary);
  
  console.log("\n=== Generated Meme Coin Template ===");
  console.log(JSON.stringify(result.analysis.template, null, 2));
  
  console.log("\n=== IPFS Storage Information ===");
  if (result.ipfs.mock) {
    console.log('Note: Using mock IPFS data (Pinata credentials not configured)');
  } else if (result.ipfs.error) {
    console.log('Warning: Failed to store on IPFS -', result.ipfs.error);
  } else {
    console.log(`IPFS URI: ${result.ipfs.uri}`);
    console.log(`Gateway URL: ${result.ipfs.gateway_url}`);
  }
}

async function runChatMode(agent, config) {
  let rl;
  try {
    console.log("Starting chat mode... Type 'exit' to end.");
    console.log("Available commands:");
    console.log("- kamkardo: Analyze Twitter data and create meme coin template");
    console.log("- exit: End the session");
    
    let twitterService;
    try {
      twitterService = new TwitterService();
      console.log("✓ Twitter service initialized successfully");
    } catch (error) {
      console.error("✗ Failed to initialize Twitter service:", error.message);
      console.log("Please check your Twitter API credentials in .env file");
      throw error;
    }
    
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      if (userInput.toLowerCase().startsWith("kamkardo")) {
        console.log("\n=== Starting Twitter Analysis ===");
        
        const twitterHandle = await question("Enter Twitter handle (without @): ");
        const productInfo = await question("Enter product info: ");
        const walletAddress = await question("Enter wallet address (or press enter to use current wallet): ");
        
        const finalWalletAddress = walletAddress.trim() || config.walletAddress;
        
        try {
          console.log("\n🔍 Analyzing Twitter data and generating template...");
          const result = await processProductAnalysis(twitterService, {
            twitterHandle,
            productInfo,
            walletAddress: finalWalletAddress
          });
          
          console.log("\n✓ Analysis completed successfully!");
          console.log("\n=== Generated Template ===");
          console.log(JSON.stringify(result.template, null, 2));
          
          console.log("\n=== IPFS Storage ===");
          if (result.ipfs.mock) {
            console.log('⚠️  Using mock IPFS data (Pinata credentials not configured)');
          } else if (result.ipfs.error) {
            console.log('⚠️  Failed to store on IPFS:', result.ipfs.error);
          } else {
            console.log('✓ Successfully stored on IPFS:');
            console.log(`URI: ${result.ipfs.uri}`);
            console.log(`Gateway URL: ${result.ipfs.gateway_url}`);
          }
        } catch (error) {
          console.error("\n✗ Error during analysis:", error.message);
          if (error.message.includes('Twitter API')) {
            console.log("Please check your Twitter API credentials and rate limits");
          }
        }
        continue;
      }

      // Normal agent interaction
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
    console.error("Fatal error:", error.message);
    throw error;
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

module.exports = { 
  runChatMode, 
  runAutonomousMode,
  processProductAnalysis // Export if needed elsewhere
};
