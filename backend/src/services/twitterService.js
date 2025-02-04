const { TwitterApi } = require('twitter-api-v2');
const { ChatOpenAI } = require("@langchain/openai");
const config = require('../config/config');

class TwitterService {
  constructor() {
    this.initializeTwitterClient();
    this.initializeOpenAI();
  }

  initializeTwitterClient() {
    try {
      this.client = new TwitterApi({
        appKey: config.twitter.apiKey,
        appSecret: config.twitter.apiSecret,
        accessToken: config.twitter.accessToken,
        accessSecret: config.twitter.accessSecret,
      });
      
      // Test the client
      this.client.v2.me().catch(error => {
        throw new Error(`Twitter API initialization failed: ${error.message}`);
      });
    } catch (error) {
      throw new Error(`Failed to initialize Twitter client: ${error.message}`);
    }
  }

  initializeOpenAI() {
    if (!config.openai.apiKey) {
      throw new Error('Missing OpenAI API key');
    }

    this.llm = new ChatOpenAI({
      model: config.openai.model,
      temperature: 0.7,
    });
  }

  async extractKeywords(productInfo) {
    const prompt = `
      Extract relevant keywords from this product information for Twitter search.
      Product Info: ${productInfo}
      Return only the most relevant 3-4 keywords separated by spaces.
    `;

    const response = await this.llm.invoke(prompt);
    return response.content.trim().split(/\s+/);
  }

  async scrapeTwitterData(handle, keywords, maxResults = 100) {
    const queries = [
      `from:${handle}`,
      ...keywords.map(keyword => `${keyword} from:${handle}`),
      ...keywords.map(keyword => keyword)
    ];

    let allTweets = [];
    
    for (const query of queries) {
      try {
        const tweets = await this.client.v2.search(query, {
          max_results: maxResults / queries.length,
          'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
          'user.fields': ['username', 'verified'],
          expansions: ['author_id']
        });

        if (tweets.data) {
          allTweets.push(...tweets.data);
        }
      } catch (error) {
        console.warn(`Warning: Error fetching tweets for query "${query}":`, error.message);
      }
    }

    return [...new Map(allTweets.map(tweet => [tweet.id, tweet])).values()];
  }

  async generateTemplate(tweets, productInfo, walletAddress) {
    const tweetTexts = tweets.map(t => t.text).join('\n');
    
    const prompt = `
      Analyze these tweets and product information to create a structured template.
      
      Product Info: ${productInfo}
      Tweets: ${tweetTexts}
      
      Generate a JSON object with these fields:
      - company_name: Extract or derive company name
      - meme_coin_name: Create a catchy name combining product aspects with crypto terms
      - product_info: Summarize key product information
      - product_category: Identify the main product category
      - product_aims: What problems does it solve or aims to achieve
      - product_usecase: Main use cases and applications
      - wallet_address: "${walletAddress}"
      
      Make it engaging and suitable for a meme coin while staying true to the product's essence.
    `;

    const response = await this.llm.invoke(prompt);
    const template = JSON.parse(response.content);
    template.wallet_address = walletAddress;
    
    return template;
  }
}

module.exports = TwitterService; 