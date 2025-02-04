const { TwitterApi } = require('twitter-api-v2');
const { ChatOpenAI } = require("@langchain/openai");

class TwitterService {
  constructor() {
    // Validate Twitter credentials
    const requiredEnvVars = [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].includes('your_'));
    if (missingVars.length > 0) {
      throw new Error(`Missing or invalid Twitter credentials: ${missingVars.join(', ')}`);
    }

    try {
      this.client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });
      
      // Test the client
      this.client.v2.me().catch(error => {
        throw new Error(`Twitter API initialization failed: ${error.message}`);
      });
    } catch (error) {
      throw new Error(`Failed to initialize Twitter client: ${error.message}`);
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }

    this.llm = new ChatOpenAI({
      model: "gpt-4-turbo-preview",
      temperature: 0.7,
    });
  }

  async getUserTweets(userId, maxResults = 10) {
    try {
      const tweets = await this.client.v2.userTimeline(userId, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics'],
      });
      return tweets.data;
    } catch (error) {
      console.error('Error fetching tweets:', error);
      throw error;
    }
  }

  async searchTweets(query, maxResults = 10) {
    try {
      const tweets = await this.client.v2.search(query, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics'],
      });
      return tweets.data;
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  async searchProductMentions(productName, accountAddress, maxResults = 100) {
    try {
      // Add input validation
      if (!productName || !accountAddress) {
        throw new Error('Product name and account address are required');
      }

      // Create search query combining product name and account address
      const query = `${productName} ${accountAddress} -is:retweet`;
      
      const tweets = await this.client.v2.search(query, {
        max_results: maxResults,
        'tweet.fields': [
          'created_at',
          'public_metrics',
          'author_id',
          'conversation_id'
        ],
        'user.fields': [
          'username',
          'verified',
          'description'
        ],
        expansions: ['author_id']
      });

      // Process and structure the data
      const processedData = tweets.data.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        metrics: tweet.public_metrics,
        author: tweets.includes.users.find(user => user.id === tweet.author_id),
        relevanceScore: this.calculateRelevanceScore(tweet.text, productName, accountAddress)
      }));

      return {
        query: {
          productName,
          accountAddress
        },
        timestamp: new Date().toISOString(),
        totalTweets: processedData.length,
        tweets: processedData.sort((a, b) => b.relevanceScore - a.relevanceScore)
      };
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  calculateRelevanceScore(tweetText, productName, accountAddress) {
    let score = 0;
    const text = tweetText.toLowerCase();
    const product = productName.toLowerCase();

    // Check for exact matches
    if (text.includes(product)) score += 5;
    if (text.includes(accountAddress.toLowerCase())) score += 3;

    // Check for engagement indicators
    if (text.includes('review')) score += 2;
    if (text.includes('recommend')) score += 2;
    if (text.includes('bought')) score += 2;
    if (text.includes('using')) score += 1;

    // Sentiment indicators (basic)
    if (text.includes('great') || text.includes('good')) score += 1;
    if (text.includes('bad') || text.includes('poor')) score -= 1;

    return score;
  }

  async generateProductSummary(tweets, productName) {
    try {
      const tweetTexts = tweets.map(t => t.text).join('\n');
      
      const prompt = `
        Analyze these tweets about the product "${productName}" and create a comprehensive summary.
        Focus on identifying:
        1. Main product features and benefits
        2. Common use cases mentioned
        3. Target audience/market
        4. Overall sentiment
        5. Key differentiators
        
        Tweets to analyze:
        ${tweetTexts}
      `;

      const response = await this.llm.invoke(prompt);
      return response.content;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  async generateStructuredTemplate(tweets, productName, accountAddress) {
    try {
      const tweetTexts = tweets.map(t => t.text).join('\n');
      
      const prompt = `
        Based on these tweets about "${productName}", generate a structured JSON template.
        Include creative and relevant information for a meme coin based on this product.
        
        Tweets:
        ${tweetTexts}
        
        Generate a JSON object with these fields:
        - company_name: Extract or derive company name
        - meme_coin_name: Create a catchy name combining product aspects with crypto terms
        - product_info: Summarize key product information
        - product_category: Identify the main product category
        - product_aims: What problems does it solve or aims to achieve
        - product_usecase: Main use cases and applications
        - wallet_address: "${accountAddress}"
        
        Make it engaging and suitable for a meme coin while staying true to the product's essence.
      `;

      const response = await this.llm.invoke(prompt);
      const template = JSON.parse(response.content);
      
      // Ensure wallet address is included
      template.wallet_address = accountAddress;
      
      return template;
    } catch (error) {
      console.error('Error generating template:', error);
      throw error;
    }
  }

  async getDetailedProductAnalysis(productName, accountAddress) {
    const data = await this.searchProductMentions(productName, accountAddress);
    
    // Generate summary and template
    const summary = await this.generateProductSummary(data.tweets, productName);
    const template = await this.generateStructuredTemplate(data.tweets, productName, accountAddress);
    
    // Existing analysis
    const analysis = {
      totalMentions: data.totalTweets,
      highEngagementTweets: data.tweets.filter(t => 
        (t.metrics.retweet_count + t.metrics.like_count) > 10
      ),
      verifiedUserMentions: data.tweets.filter(t => t.author.verified),
      sentimentBreakdown: {
        positive: data.tweets.filter(t => t.relevanceScore > 5).length,
        neutral: data.tweets.filter(t => t.relevanceScore >= 0 && t.relevanceScore <= 5).length,
        negative: data.tweets.filter(t => t.relevanceScore < 0).length
      }
    };

    return {
      ...data,
      analysis,
      summary,
      template
    };
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
      `from:${handle}`, // Tweets from the handle
      ...keywords.map(keyword => `${keyword} from:${handle}`), // Handle tweets with keywords
      ...keywords.map(keyword => keyword) // General tweets with keywords
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

    // Remove duplicates
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
    template.wallet_address = walletAddress; // Ensure wallet address is included
    
    return template;
  }
}

module.exports = TwitterService; 