require('dotenv').config();

const config = {
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
    maxTweetsPerQuery: parseInt(process.env.MAX_TWEETS_PER_QUERY) || 10,
    searchLimit: parseInt(process.env.TWITTER_SEARCH_LIMIT) || 50
  },
  ipfs: {
    pinataApiKey: process.env.PINATA_API_KEY,
    pinataSecretKey: process.env.PINATA_SECRET_KEY
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4-turbo-preview"
  },
  cdp: {
    apiKeyName: process.env.CDP_API_KEY_NAME,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    networkId: process.env.NETWORK_ID || "base-sepolia"
  }
};

module.exports = config; 